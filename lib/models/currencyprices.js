
const SortedArray = require('sorted-array');
const Moment = require('moment');
const R = require('ramda');
const RA = require('ramda-adjunct');

const PairPrice = require('./pairprice');
const dates = require('../utils/dates');
const { arrayToObjects } = require('../utils/models');
const { ERRORS } = require('./constants');
const { makeError } = require('../utils/errors');

function ensureMoment(work) {
  if (Moment.isMoment(work)) {
    return work;
  }if (RA.isString(work)) {
    return Moment(work);
  }if (RA.isObj(work) && R.has('utc', work)) {
    return ensureMoment(work.utc);
  }
  throw makeError(TypeError, ERRORS.INVALID_TERM, `Invalid search term: ${work}`);
}

/**
 * A price history for a specific currency.
 */
class CurrencyPrices extends SortedArray {
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
    if (!R.isNil(within) && diff > within * 1000) {
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

  /**
   * Get the price nearest the date.
   * @param {String|Moment} utc
   * @return {PairPrice} price
   */
  search(utc) {
    const searchUtc = Moment(utc);
    const ix = super.search(searchUtc);
    if (ix === -1) {
      throw new RangeError(ERRORS.NOT_FOUND);
    }
    return this.get(ix);
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @return {Array<Object>}
   */
  toObject() {
    return arrayToObjects(this);
  }
}

module.exports = CurrencyPrices;
//# sourceMappingURL=currencyprices.js.map
