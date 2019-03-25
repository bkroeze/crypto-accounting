const Moment = require('moment');
const BigNumber = require('bignumber.js');
const R = require('ramda');
const RA = require('ramda-adjunct');

const utils = require('../utils/models');
const { BIG_0, BIG_1 } = require('../utils/numbers');
const { ERRORS } = require('./constants');
const { makeError } = require('../utils/errors');

const DEFAULT_PROPS = {
  id: null,
  utc: null,
  pair: null,
  base: null,
  quote: null,
  rate: BIG_0,
  note: '',
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);
const isComment = R.startsWith('#');

/**
 * Flexibly parse a props object, which can be a shortcut or an object.
 * @param {String|Object} props object or shortcut string
 * @return {Object} parsed object
 * @throws {TypeError} if shortcut cannot be parsed
 */
function parseProps(props) {
  if (RA.isString(props)) {
    const parts = utils.splitAndTrim(props);
    if (parts.length < 3) {
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        `Invalid price history shortcut: ${props}`
      );
    }
    const keyParts = parts[1].split('/');
    if (keyParts.length < 2) {
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        `Invalid price history pair: ${parts[1]}`
      );
    }
    const note = (parts.length > 3 && isComment(parts[3])) ? parts[3].slice(1) : '';
    return {
      utc: parts[0],
      base: keyParts[0],
      pair: parts[1],
      quote: keyParts[1],
      rate: parts[2],
      note,
    };
  }
  return props;
}

/**
 * Represents a price for a pair at a specific date
 */
class PairPrice {
  /**
   * Flexibly create using either a shortcut or an object.
   * @param {String|Object} props object or shortcut string
   * @throws {TypeError} if shortcut cannot be parsed
   */
  constructor(props) {
    this.translationChain = null;
    const converted = parseProps(props);
    const merged = R.merge(DEFAULT_PROPS, getProps(converted));

    KEYS.forEach((key) => {
      let val = merged[key];
      if (key === 'utc') {
        val = Moment(val);
      }
      if (key === 'rate') {
        val = BigNumber(val);
      }
      this[key] = val;
    });

    if (!this.pair) {
      this.pair = `${this.base}/${this.quote}`;
    }
    if (!this.id) {
      this.id = `${this.pair}:${this.utc.format('x')}`;
    }
  }

  static sort(prices) {
    prices.sort((a, b) => a.compare(b));
    return prices;
  }

  compare(other) {
    if (this.utc.isBefore(other.utc)) {
      return -1;
    }
    if (this.utc.isAfter(other.utc)) {
      return 1;
    }

    if (other.quote === this.quote) {
      if (other.base === this.base) {
        return 0;
      }
      return this.base < other.base ? -1 : 1;
    }
    return this.quote < other.quote ? -1 : 1;
  }

  /**
   * Create a reversed version of this price
   */
  invert() {
    return new PairPrice({
      pair: `${this.quote}/${this.base}`,
      base: this.quote,
      quote: this.base,
      utc: this.utc.toISOString(),
      rate: BIG_1.div(this.rate),
      note: this.note,
    });
  }

  /**
   * Set the chain used to translate between pairs where no direct price is available.
   * @param {Array<PairPrice>} prices
   */
  setTranslationChain(prices) {
    this.translationChain = prices;
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @param {Object} options - "shallow" or "yaml" reduce output of child objects if true
   * @return {Object<String, *>}
   */
  toObject(options = {}) {
    const {shallow, yaml, db} = options;
    const props = {
      id: this.id,
      pair: this.pair,
      utc: db ? this.utc.toDate() : this.utc.toISOString(),
      base: this.base,
      quote: this.quote,
      rate: this.rate.toFixed(8),
      note: this.note,
    };
    if (db) {
      props.derived = this.derived;
    }
    if (!yaml && !db) {
      props.derived = this.derived;
      props.translationChain = utils.arrayToObjects(this.translationChain || [], shallow);
    }
    return utils.stripFalsy(props);
  }

  toString() {
    return `PairPrice: ${this.utc.toISOString()} ${this.pair} ${this.rate}`;
  }
}

module.exports = PairPrice;
