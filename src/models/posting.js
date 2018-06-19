import * as R from 'ramda';
const BigNumber = require('bignumber.js');
import {stripFalsyExcept} from './modelUtils';

/**
 * Base model for a Credit or Debit
 */

const DEFAULT_PROPS = {
  quantity: null,
  currency: '',
  account: '',
  type: 'debit',
  note: '',
  shortcut: '',
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);

const isString = R.is(String);

const mapTrim = R.map(R.trim);

const splitSpace = R.split(' ');

const numberRe = new RegExp(/^-?[0-9\.]+$/);

const looksNumeric = (val) => val.search(numberRe) > -1;

const startsWithCarat = R.startsWith('^');
const isConnector = R.contains(R.__, ['@', '=']);

export class Posting {
  /**
   * Construct using a `props` object that must include "utc", and may also
   * include "notes", "tags", and a list of transactions
   * @param {object} props.  If it is a string, it will be interpreted as the "shortcut"
   */
  constructor(props={}) {
    const work = isString(props) ? {shortcut: props} : props;

    const merged = R.merge(DEFAULT_PROPS, getProps(work));

    if (merged.shortcut && (merged.currency || merged.amount)) {
      log.error(`Invalid Posting, can't specify a shortcut and currency/amount: ${JSON.stringify(props)}`);
      throw new Error('Invalid Posting, conflicting shortcut');
    }

    KEYS.forEach(key => {
      this[key] = merged[key];
    });

    if (merged.shortcut) {
      this.applyShortcut(merged.shortcut);
    }
  }

  applyShortcut(shortcut) {
    const parts = mapTrim(splitSpace(shortcut));
    // minimal shortcut: "10 BTC"
    if (parts.length != 2 && parts.length != 3) {
      throw new Error(`Invalid shortcut: ${shortcut}`);
    }
    // determine which part is the currency
    let quantity, currency;

    const numeric1 = looksNumeric(parts[0]);
    const numeric2 = looksNumeric(parts[1]);

    if (parts.length === 3) {
      if (!startsWithCarat(parts[2])) {
        throw new Error(`Invalid Posting, third word in shortcut is not recognized: ${shortcut}`);
      } else {
        this.account = parts[2].slice(1);
      }
    }

    if (numeric1 && numeric2) {
      throw new Error(`Invalid Posting, two numeric in shortcut: ${shortcut}`)
    }

    if (!(numeric1 || numeric2)) {
      throw new Error(`Invalid Posting, no numeric in shortcut: ${shortcut}`)
    }

    if (numeric1) {
      quantity = parts[0];
      currency = parts[1];
    } else {
      quantity = parts[1];
      currency = parts[0];
    }
    this.quantity = BigNumber(quantity);
    this.currency = currency;
  }

  /**
   * Multiplies the current quantity by the quantity in the passed `Posting`.
   * @param {Posting} posting
   * @return {Posting} this
   */
  multiplyBy(posting, flipSign) {
    this.quantity = this.quantity.times(posting.quantity);
    return this;
  }

  toObject() {
    return stripFalsyExcept({
      quantity: this.quantity,
      currency: this.currency,
      account: this.account,
      note: this.note,
    });
  }

  toString() {
    // should use currency definition for precision
    return `${this.quantity.toFixed(8)} ${this.currency}`;
  }
}

/**
 * Parses an entry "shortcut" into one or more postings.
 * Shortcut can be in two forms:
 * Single posting: "number currency", "currency number"
 * Pair posting: debit [@|=] credit
 * @param {String} shortcut
 * @return {Object<string: Array<Posting>>} postings, keyed by "credits" and "debits"
 * @example "10 BTC", "$ 10", "10 BTC @ $ 8000", "-10 ETH @ .03 BTC"
 */
export function shortcutToPostings(raw_shortcut) {
  const parts = mapTrim(splitSpace(raw_shortcut));
  // minimal shortcut: "10 BTC"
  if (parts.length < 2) {
    throw new Error(`Invalid shortcut: ${raw_shortcut}`);
  }

  const postings = {debits: [], credits: []};

  let accum = [];
  let connector = '';
  let current;
  while (parts.length > 0) {
    current = parts.shift();
    if (!isConnector(current)) {
      accum.push(current);
    } else {
      if (connector) {
        throw new Error(`Invalid shortcut, two connectors: ${raw_shortcut}`);
      }
      // must have enough in accumulator for current posting, and enough left to make another
      if (accum.length < 2 || parts.length < 2) {
        throw new Error(`Invalid shortcut: ${raw_shortcut} ${accum} ${parts}`);
      }
      postings.debits.push(new Posting(accum.join(' ')));
      connector = current;
      accum = [];
    }
  }
  if (accum.length < 2) {
    throw new Error(`Invalid shortcut: ${raw_shortcut}`);
  }
  const posting = new Posting(accum.join(' '));
  if (connector === '@') {
    // if it was specified as price/each, then multiply by the amount we purchased
    posting.multiplyBy(postings.debits[0]);
    posting.type = 'credit';
  }
  if (connector) {
    postings.credits.push(posting);
  }
  else {
    postings.debits.push(posting);
  }
  return postings;
}
