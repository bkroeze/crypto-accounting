/* eslint no-console: ["error", { allow: ["error"] }] */
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';
import Moment from 'moment';
import BigNumber from 'bignumber.js';

import * as utils from '../utils/models';
import { BIG_0 } from '../utils/numbers';
import { ERRORS } from './constants';
import { makeError } from '../utils/errors';

const DEFAULT_PROPS = {
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
        'Invalid price history shortcut: ' + props);
    }
    const keyParts = parts[1].split('/');
    if (keyParts.length < 2) {
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        'Invalid price history pair: ' + parts[1]);
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

export default class PairPrice {
  /**
   * Flexibly create using either a shortcut or an object.
   * @param {String|Object} props object or shortcut string
   * @throws {TypeError} if shortcut cannot be parsed
   */
  constructor(props) {
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

  toObject() {
    return utils.stripFalsy({
      pair: this.pair,
      utc: this.utc.toISOString(),
      base: this.base,
      quote: this.quote,
      rate: this.rate.toFixed(8),
      note: this.note,
    });
  }

  toString() {
    return `PairPrice: ${this.utc.toISOString()} ${this.pair} ${this.rate}`;
  }
}