const SortedArray = require('sorted-array');
const Moment = require('moment');
const R = require('ramda');
const RA = require('ramda-adjunct');

const PairPrice = require('./pairprice');
const dates = require('../utils/dates');
const { arrayToObjects } = require('../utils/models');
const { ERRORS } = require('./constants');
const { makeError } = require('../utils/errors');
const CurrencyPrices = require('./currencyprices');

/**
 * A collection of prices for multiple currencies.
 */
class PriceHistory {
  /**
   * Instantiate via a raw list of prices
   * @param {Array<String|Object>} raw prices
   */
  constructor(pricelist) {
    this.pairs = {};
    if (pricelist) {
      if (RA.isArray(pricelist)) {
        pricelist.forEach((p) => {
          const price = new PairPrice(p);
          if (!R.has(price.pair, this.pairs)) {
            this.pairs[price.pair] = new CurrencyPrices();
          }
          this.pairs[price.pair].insert(price);
        });
      } else {
        Object.keys(pricelist).forEach((key) => {
          this.pairs[key] = new CurrencyPrices();
          pricelist[key].forEach((priceProps) => {
            this.pairs[key].insert(new PairPrice(priceProps));
          });
        });
      }
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

  /**
   * Get the prices for a pair
   * @param {String} base
   * @param {String} quote
   * @return {CurrencyPrices} prices
   */
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
