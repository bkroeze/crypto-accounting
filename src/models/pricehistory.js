import SortedArray from 'sorted-array';
import Moment from 'moment';
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';

import PairPrice from './pairprice';
import * as dates from '../utils/dates';
import { arrayToObjects } from '../utils/models';
import { ERRORS } from './constants';
import { makeError } from '../utils/errors';

function ensureMoment(work) {
  if (Moment.isMoment(work)) {
    return work;
  } if (RA.isString(work)) {
    return Moment(work);
  } if (RA.isObj(work) && R.has('utc', work)) {
    return ensureMoment(work.utc);
  }
  throw makeError(TypeError, ERRORS.INVALID_TERM, `Invalid search term: ${work}`);
}

export class CurrencyPrices extends SortedArray {
  constructor(prices) {
    super(prices || [], dates.compareByDate);
  }

  get(ix) {
    return this.array[ix];
  }

  get length() {
    return this.array.length;
  }

  /**
   * Get the element nearest in date to `utc`
   * @param {Moment} utc
   * @param {Integer} within seconds (no limit if not given or null)
   * @return {PairPrice} nearest price
   */
  findNearest(utc, within = null) {
    if (this.length === 0) {
      throw makeError(RangeError, ERRORS.EMPTY, 'Price list empty');
    }
    const searchUtc = ensureMoment(utc);
    let diff = Number.MAX_SAFE_INTEGER;
    let lo = 0;
    let hi = this.length - 1;
    let mid;
    let currentDiff;
    let currentDate;
    let val = this.get(0);

    while (lo <= hi) {
      mid = lo + (hi - lo) / 2 >>> 0;
      currentDate = this.get(mid).utc;
      currentDiff = Math.abs(searchUtc.diff(currentDate));
      if (currentDiff < diff) {
        diff = currentDiff;
        val = this.get(mid);
      }
      if (currentDate.isBefore(searchUtc)) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (!R.isNil(within) && diff > (within * 1000)) {
      throw makeError(RangeError, ERRORS.OUT_OF_RANGE, `Cannot find a price at ${searchUtc.toISOString()} within ${within} seconds`);
    }
    return val;
  }

  forEach(fn) {
    this.array.forEach(fn);
  }

  map(fn) {
    return this.array.map(fn);
  }

  search(utc) {
    const searchUtc = Moment(utc);
    const ix = super.search(searchUtc);
    if (ix === -1) {
      throw new RangeError(ERRORS.NOT_FOUND);
    }
    return this.get(ix);
  }

  toObject() {
    return arrayToObjects(this);
  }
}

export default class PriceHistory {
  constructor(pricelist) {
    this.pairs = {};
    if (pricelist) {
      pricelist.forEach((p) => {
        const price = new PairPrice(p);
        if (!R.has(price.pair, this.pairs)) {
          this.pairs[price.pair] = new CurrencyPrices();
        }
        this.pairs[price.pair].insert(price);
      });
    }
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
    const status = this.hasPair(base, quote);
    if (status === -1) {
      return this.getPair(quote, base).findNearest(utc).invert();
    }
    if (status === 1) {
      return this.pairs[`${base}/${quote}`].findNearest(utc);
    }
    return this.derivePrice(utc, base, quote, transCurrencies, within);
  }

  getPair(base, quote) {
    return this.pairs[`${base}/${quote}`];
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
    if (R.has(`${base}/${quote}`, this.pairs)) {
      return 1;
    }
    if (R.has(`${quote}/${base}`, this.pairs)) {
      return -1;
    }
    return 0;
  }

  toObject() {
    const rv = {};
    R.keysIn(this.pairs).forEach((key) => {
      rv[key] = arrayToObjects(this.pairs[key]);
    });
    return rv;
  }
}
