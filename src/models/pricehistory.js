const SortedArray = require('sorted-array');
const Moment = require('moment');
const R = require('ramda');
const RA = require('ramda-adjunct');

const PairPrice = require('./pairprice');
const dates = require('../utils/dates');
const { arrayToObjects } = require('../utils/models');
const { ERRORS } = require('./constants');
const { makeError } = require('../utils/errors');
const { initDB, ensureUTC } = require('../loaders/storage');
const { getPriceCollection, addPrice } = require('../loaders/priceDB');
const { ensureDate, ensureMoment } = require('../utils/dates');
const log = require('../utils/logging').get('models.pricehistory');

/**
 * A collection of prices for multiple currencies.
 */
class PriceHistory {
  /**
   * Instantiate via a raw list of prices
   * @param {Array<String|Object>} raw prices
   * @param {String} filename of LokiDB to open or create
   */
  constructor(pricelist, filename='prices') {
    initDB(filename);
    this.isLoaded = false;
    this.priceCollection = null;
    this.addPrices(pricelist);
  }

  static load(pricelist, filename='prices') {
    const history = new PriceHistory(pricelist, filename);
    return history.waitForLoad();
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

  addPrices(pricelist) {
    getPriceCollection(prices => {
      this.priceCollection = prices;
      if (pricelist) {
        if (RA.isArray(pricelist)) {
          pricelist.forEach((p) => {
            addPrice(new PairPrice(p), prices);
          });
        } else {
          Object.keys(pricelist).forEach((key) => {
            pricelist[key].forEach((priceProps) => {
              addPrice(new PairPrice(priceProps), prices);
            });
          });
        }
      }
      this.isLoaded = true;
    });
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

    throw makeError(RangeError, ERRORS.NOT_FOUND, `${base}/${quote}`);
  }

  /**
   * Find the nearest price for the given currency pair
   * @param {String|Moment|Object} utc
   * @param {String} base currency
   * @param {String} quote currency - the rate refers to this many of this currency for 1 base
   * @param {Array} currencies to use as bases for derivation
   * @param {Integer} within seconds (no limit if not given or null)
   * @return {PairPrice}
   * @throws {RangeError} with code "ERR_DISTANCE" if nearest is out of range
   * @throws {RangeError} with code "ERR_NOT_FOUND" if pair is not present and cannot be derived
   */
  findPrice(utc, base, quote, transCurrencies = ['BTC', 'ETH'], within = null) {
    const utcMoment = ensureMoment(utc);
    const utcDate = ensureDate(utc);
    const status = this.hasPair(base, quote);
    if (status === 0) {
      return this.derivePrice(utc, base, quote, transCurrencies, within);
    }

    const pairColl = status === -1 ? this.getPair(quote, base)
          : this.getPair(base, quote);

    const possibles = R.flatten([
      pairColl.find({'utc': {$gte, utc}}).simplesort('utc').limit(1),
      pairColl.find({'utc': {$lte, utc}}).simplesort('utc', false).limit(1),
    ]);

    let best = null;

    if (possibles.length === 1) {
      best = new PairPrice(possibles[0]);
    }
    if (possibles.length === 2) {
      const diff0 = Math.abs(utcMoment.diff(ensureMoment(possibles[0].utc)));
      const diff1 = Math.abs(utcMoment.diff(ensureMoment(possibles[1].utc)));
      best = (diff0 < diff1) ? possibles[0] : possibles[1];
    }

    if (Math.abs(utcMoment.diff(ensureMoment(best.utc)) > (within * 1000))) {
      this.log.debug(`Nearest price ${best} is farther than ${within} seconds from ${utc}, attempting to derive`);
      return this.derivePrice(utc, base, quote, transCurrencies, within);
    }

    const price = new PairPrice(best);
    if (status === -1) {
      return price.invert();
    }
    return price;
  }

  /**
   * Get the prices for a pair
   * @param {String} base
   * @param {String} quote
   * @return {LokiCollection} prices
   */
  getPair(base, quote) {
    return this.priceCollection.find({base, quote});
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
    if (this.priceCollection.findOne({pair: `${base}/${quote}`}) !== null) {
      return 1;
    }
    if (this.priceCollection.findOne({pair: `${quote}/${base}`}) !== null) {
      return -1;
    }
    return 0;
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

module.exports = PriceHistory;
