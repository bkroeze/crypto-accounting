import SortedArray from 'sorted-array';
import Moment from 'moment';
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';

import PairPrice from './pairprice';
import { compareByDate } from '../utils/dates';
import { arrayToObjects } from '../utils/models';
import { ERRORS } from './constants';
import { makeError } from '../utils/errors';

function ensureMoment(work) {
  if (Moment.isMoment(work)) {
    return work;
  } else if(RA.isString(work)) {
    return Moment(work);
  } else if(RA.isObj(work) && R.has('utc', work)) {
    return ensureMoment(work.utc);
  } else {
    throw makeError(TypeError, ERRORS.INVALID_TERM, `Invalid search term: ${work}`);
  }
}

export class CurrencyPrices extends SortedArray {
  constructor(prices) {
    super(prices || [], compareByDate);
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
  findNearest(utc, within=null) {
    if (this.length === 0) {
      throw makeError(RangeError, ERRORS.EMPTY, 'Price list empty');
    }
    const searchUtc = ensureMoment(utc);
    let diff = Number.MAX_SAFE_INTEGER;
    let lo = 0;
    let hi = this.length-1;
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
    const searchUtc = ensureUtc(utc);
    const ix = super.search(work);
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
    pricelist.forEach(p => {
      const price = new PairPrice(p);
      if (!R.has(price.pair, this.pairs)) {
        this.pairs[price.pair] = new CurrencyPrices();
      }
      this.pairs[price.pair].insert(price)
    });
  }

  /**
   * Find the nearest price for the given currency pair
   * @param {String|Moment|Object} utc
   * @param {String} base currency
   * @param {String} quote currency
   * @param {Integer} within seconds (no limit if not given or null)
   * @return {PairPrice}
   * @throws {RangeError} with code "ERR_DISTANCE" if nearest is out of range
   * @throws {RangeError} with code "ERR_NOT_FOUND" if pair is not present
   */
  findPrice(utc, base, quote, within=null) {
    const pair = `${base}/${quote}`;
    if (!this.hasPair(pair)) {
      throw makeError(RangeError, ERRORS.NOT_FOUND, pair);
    }
    return this.pairs[pair].findNearest(utc);
  }

  hasPair(pair) {
    return R.has(pair, this.pairs);
  }

  toObject() {
    rv = {};
    R.keysIn(this.pairs).forEach(key => {
      rv[key] = arrayToObjects(utils.this.pairs[key]);
    });
    return rv;
  }
}
