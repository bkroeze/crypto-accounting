/* eslint no-await-in-loop: "off" */
import Moment from 'moment';
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';
import Maybe from 'folktale/maybe';

import { get as getLogger } from 'js-logger';
import { PairPrice } from './pairprice';
import * as dates from '../utils/dates';
import { arrayToObjects } from '../utils/models';
import { ERRORS } from './constants';
import { makeError } from '../utils/errors';
import { initDB } from '../loaders/storage';
import { getPriceCollection, addPrice } from '../loaders/priceDB';

const log = getLogger('models.pricehistory');

const isPairPrice = R.is(PairPrice);
const missingUTC = rec => !R.has('UTC', rec);
/**
 * A collection of prices for multiple currencies.
 */
export class PriceHistory {
  /**
   * Instantiate via a raw list of prices
   * @param {Array<String|Object>} raw prices
   * @param {String} filename of LokiDB to open or create
   */
  constructor(pricelist, filename = 'prices') {
    initDB(filename);
    this.isLoaded = false;
    this.priceCollection = null;
    this.addPrices(pricelist);
    this.filename = filename;
  }

  static load(pricelist, filename = 'prices') {
    const history = new PriceHistory(pricelist, filename);
    return history.waitForLoad();
  }

  /**
   * Find any missing days in a sorted collection.
   */
  static findGaps(collection) {
    const gaps = [];
    if (collection.length > 0) {
      const current = Moment.utc(collection[0].utc);
      let record;
      for (let i = 1; i < collection.length; i++) {
        current.add(1, 'day');
        record = Moment.utc(collection[i].utc);
        while (!current.isSame(record, 'day')) {
          gaps.push(current.clone());
          current.add(1, 'day');
        }
      }
    }
    return gaps;
  }

  waitForLoad() {
    return new Promise((resolve) => {
      const checker = () => {
        if (this.isLoaded) {
          resolve(this);
        } else {
          setTimeout(checker, 100);
        }
      };
      setTimeout(checker, 50);
    });
  }

  safeAddPrice(price, prices) {
    if (!this.isLoaded) {
      throw new Error('DB not yet loaded.');
    }
    if (!prices) {
      throw new Error('No price collection');
    }
    return addPrice(new PairPrice(price), prices);
  }

  async addPrices(pricelist) {
    const prices = await getPriceCollection();
    log.info({msg: "got prices", prices});
    this.priceCollection = prices;
    if (pricelist) {
      if (RA.isArray(pricelist)) {
        for (let ix = 0; ix < pricelist.length; ix += 1) {
          const p = pricelist[ix];
          if (isPairPrice(p)) {
            await addPrice(p, prices);
          } else {
            await addPrice(new PairPrice(p), prices);
          }
        }
      } else {
        const vals = Object.values(pricelist);
        for (let ix = 0; ix < vals.length; ix += 1) {
          const priceProps = vals[ix];
          await addPrice(new PairPrice(priceProps), prices);
        }
      }
    }
    this.isLoaded = true;
  }

  flush() {
    if (this.isLoaded) {
      this.priceCollection.flushChanges();
    }
  }

  cleanPair(base, quote) {
    const toRemove = [];
    this.priceCollection
      .find({ base, quote })
      .filter(missingUTC)
      .forEach((rec) => {
        toRemove.push(rec);
      });

    if (toRemove.length > 0) {
      this.priceCollection.findAndRemove({ $loki: { $in: toRemove } });
    }
    return { removed: toRemove.length };
  }

  deletePair(base, quote) {
    const toRemove = [];
    this.priceCollection
      .find({ base, quote })
      .forEach((rec) => {
        toRemove.push(rec);
      });

    if (toRemove.length > 0) {
      this.priceCollection.findAndRemove({ $loki: { $in: toRemove } });
    }
    return { removed: toRemove.length };
  }

  /**
   * Get the best price possible by following a chain of translations.
   * @param {String|Moment|Object} utc
   * @param {String} base currency
   * @param {String} quote currency - the rate refers to this many of this currency for 1 base
   * @param {Array} currencies to use as translations for derivation
   * @param {Integer} within seconds (no limit if not given or null)
   * @return {PairPrice}
   * @throws {RangeError} with code "ERR_DISTANCE" if nearest is out of range
   * @throws {RangeError} with code "ERR_NOT_FOUND" if pair is not present and cannot be derived
   */
  derivePrice(utc, base, quote, transCurrencies = ['BTC', 'ETH'], within = null) {
    if (transCurrencies) {
      const chain = [];
      let quoteStatus;
      let transStatus;
      let transCurrency;
      let i;

      for (i = 0; i < transCurrencies.length; i++) {
        transCurrency = transCurrencies[i];
        quoteStatus = this.hasPair(transCurrency, quote);
        // console.log(`qs hasPair(${transCurrency}/${quote}) = ${quoteStatus}`);
        transStatus = this.hasPair(transCurrency, base);
        // console.log(`bs hasPair(${transCurrency}/${quote}) = ${transStatus}`);
        if (quoteStatus !== 0 && transStatus !== 0) {
          // great, we found the same base to use as translation
          // now get the relevant prices
          chain.push(this.findPrice(utc, base, transCurrency, null, within));
          chain.push(this.findPrice(utc, transCurrency, quote, null, within));
          break;
        }
      }

      if (chain.length > 1) {
        const price = new PairPrice({
          utc: dates.averageDates(chain[0].utc, chain[1].utc),
          base,
          quote,
          rate: chain[0].rate.times(chain[1].rate),
        });
        price.setTranslationChain(chain);
        return price;
      }
    }

    console.error(`Cannot find price for ${base}/${quote} on ${utc.toISOString()}`);

    throw makeError(RangeError, ERRORS.NOT_FOUND, `${base}/${quote}`);
  }

  /**
   * Finds all "gaps" in the price history, for any transaction pair in the journal
   * @param {Journal} journal
   * @returns {Array<Object<pair: string, utc: Moment>>} Array of pair, utc objects
   */
  findMissingDatesInJournal(journal, fiatCurrency = null) {
    const NEED = 1;
    const TRANSLATE = 2;

    const datesNeeded = {};
    const fiat = fiatCurrency || journal.getFiatDefault().id;
    const translations = journal.getTranslationCurrencies().map(curr => curr.id);
    const isTranslation = currency => translations.indexOf(currency) > -1;

    journal.transactions.forEach((transaction) => {
      const utc = Moment.utc(transaction.utc).toISOString().substring(0, 10);
      // console.log(`Transaction: id=${transaction.id} ${utc}`);
      transaction.forEach((entry) => {
        if (entry.currency !== fiat) {
          // console.log(`entry: ${JSON.stringify(entry.toObject({shallow:true}))}`);
          const status = isTranslation(entry.currency) ? NEED : TRANSLATE;
          datesNeeded[`${entry.currency}/${fiat}@${utc}`] = status;
        }
      });
    });

    // see if we have dates for each;
    const keys = Object.keys(datesNeeded)
      .filter((key) => {
        const status = datesNeeded[key];
        const [symbol, utc] = key.split('@');
        const [base, quote] = symbol.split('/');
        if (this.hasDayPrice(base, quote, utc)) {
          return false;
        }
        if (status === TRANSLATE) {
          const xlate = this.hasTranslatedDayPrice(base, quote, utc, translations).getOrElse(null);
          if (xlate) {
            return false;
          }
        }
        return true;
      });

    keys.sort();
    return {
      fiat,
      translations,
      isEmpty: keys.length === 0,
      missing: keys.map((key) => {
        const [pair, utc] = key.split('@');
        return { pair, utc: Moment.utc(utc).startOf('day') };
      }),
    };
  }

  /**
   * Find the nearest price on the same UTC day for the given currency pair
   * @param {String|Moment|Object} utc
   * @param {String} base currency
   * @param {String} quote currency - the rate refers to this many of this currency for 1 base
   * @param {Array} currencies to use as bases for derivation
   * @param {Integer} within seconds (no limit if not given or null)
   * @return {PairPrice}
   * @throws {RangeError} with code "ERR_DISTANCE" if nearest is out of range
   * @throws {RangeError} with code "ERR_NOT_FOUND" if pair is not present and cannot be derived
   */
  findPrice(utc, base, quote, transCurrencies = ['BTC', 'ETH', 'USD'], within = null) {
    const utcMoment = Moment.utc(utc);
    const startDay = utcMoment.clone().startOf('day').toDate();
    const endDay = utcMoment.clone().endOf('day').toDate();
    const utcDate = utcMoment.toDate();
    const status = this.hasDayPrice(base, quote, utc);
    if (status === 0) {
      return this.derivePrice(utcDate, base, quote, transCurrencies, within);
    }

    const dayPrices = this.priceCollection
      .chain()
      .find({ utc: { $between: [startDay, endDay] } });

    const pairColl1 = status === -1 ? dayPrices.branch().find({ base: quote, quote: base })
      : dayPrices.branch().find({ base, quote });

    const pairColl2 = pairColl1.branch();

    const possibles = R.flatten([
      pairColl1.find({ utc: { $gte: utcDate } }).simplesort('utc').limit(1).data(),
      pairColl2.find({ utc: { $lte: utcDate } }).simplesort('utc', false).limit(1).data(),
    ]);
    let best = null;

    if (possibles.length === 1) {
      best = new PairPrice(possibles[0]);
    }
    if (possibles.length === 2) {
      const diff0 = Math.abs(utcMoment.diff(Moment.utc(possibles[0].utc)));
      const diff1 = Math.abs(utcMoment.diff(Moment.utc(possibles[1].utc)));
      best = new PairPrice((diff0 < diff1) ? possibles[0] : possibles[1]);
    }

    if (Math.abs(utcMoment.diff(Moment.utc(best.utc)) > (within * 1000))) {
      log.debug(`Nearest price ${best} is farther than ${within} seconds from ${utc}, attempting to derive`);
      return this.derivePrice(utcDate, base, quote, transCurrencies, within);
    }

    if (status === -1) {
      return best.invert();
    }
    return best;
  }

  /**
   * Get the prices for a pair
   * @param {String} base
   * @param {String} quote
   * @return {LokiCollection} prices
   */
  getPair(base, quote) {
    return this.priceCollection.find({ base, quote });
  }

  /**
   * Test whether we have a pair, or its inverse
   * @param {String} base
   * @param {String} quote
   * @reurn {Integer} 0 = false, 1 = true, -1 = true but inverse
   */
  hasPair(base, quote) {
    if (base === quote) {
      return 0;
    }
    if (this.priceCollection.findOne({ pair: `${base}/${quote}` }) !== null) {
      return 1;
    }
    if (this.priceCollection.findOne({ pair: `${quote}/${base}` }) !== null) {
      return -1;
    }
    return 0;
  }

  /**
   * Check for any price on the same day as this base/quote
   * @param {String} base
   * @param {String} quote
   * @param {String} utc date
   * @returns {int}  0 if not found, -1 if reversed, 1 if present
   */
  hasDayPrice(base, quote, utc) {
    const day = Moment.utc(utc);
    const dayStart = day.clone().startOf('day').toDate();
    const dayEnd = day.clone().endOf('day').toDate();
    let status = 0;

    const dayPrices = this.priceCollection
      .chain()
      .find({ utc: { $between: [dayStart, dayEnd] } })
      .simplesort('utc');

    let prices = dayPrices
      .branch()
      .find({ base, quote })
      .limit(1)
      .data();

    if (prices.length > 0) {
      status = 1;
    } else {
      // check for reverse
      prices = dayPrices
        .find({ base: quote, quote: base })
        .limit(1)
        .data();
      if (prices.length > 0) {
        status = -1;
      }
    }
    return status;
  }

  /**
   * Check for any price on the same day as this base/quote
   * using translation currencies to do it.
   * @param {String} base
   * @param {String} quote
   * @param {String} utc date
   * @param {Array<String>} translations
   * @returns {Maybe<String>}
   */
  hasTranslatedDayPrice(base, quote, utc, translations) {
    let xlate;
    for (let i = 0; i < translations.length; i++) {
      xlate = translations[i];
      if (this.hasDayPrice(base, xlate, utc)
          && this.hasDayPrice(xlate, quote, utc)) {
        return Maybe.Just(xlate);
      }
    }
    return Maybe.Nothing();
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @return {Object<String, *>}
   */
  toObject(options) {
    const rv = {};
    R.keysIn(this.pairs).forEach((key) => {
      rv[key] = arrayToObjects(this.pairs[key], options);
    });
    return rv;
  }
}
