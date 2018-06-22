import * as R from 'ramda';
import Moment from 'moment';
import BigNumber from 'bignumber.js';
import * as utils from './modelUtils';

const DEFAULT_PROPS = {
  id: null,
  transaction: null,
  quantity: null,
  currency: '',
  account: '',
  type: 'debit',
  note: '',
  shortcut: '',
};

const KEYS = R.keysIn(DEFAULT_PROPS);
const getProps = R.pick(KEYS);

export default class Entry {
  /**
   * Construct using a `props` object that must include the parent transaction
   * @param {object} props
   */
  constructor(props={}) {
    const work = utils.isString(props) ? {shortcut: props} : props;
    const merged = R.merge(DEFAULT_PROPS, getProps(work));

    if (!merged.transaction) {
      console.error(`Invalid Entry, must have a 'transaction', got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Entry, must have a parent transaction');
    }

    if (merged.shortcut && (merged.currency || merged.amount)) {
      log.error(`Invalid Entry, can't specify a shortcut and currency/amount: ${JSON.stringify(props)}`);
      throw new Error('Invalid Entry, conflicting shortcut');
    }

    KEYS.forEach(key => {
      this[key] = merged[key];
    });

    if (merged.shortcut) {
      this.applyShortcut(merged.shortcut);
    }

    if (R.isNil(this.quantity)) {
      throw new Error('Invalid Entry, no Quantity');
    }
    if (!this.account) {
      this.account = this.transaction.account;
    }

    // doesn't hurt to re-wrap if it isn't already a BigNumber
    this.quantity = new BigNumber(this.quantity);
  }

  applyShortcut(shortcut) {
    const parts = utils.splitAndTrim(shortcut);
    // minimal shortcut: "10 BTC"
    if (parts.length != 2 && parts.length != 3) {
      throw new Error(`Invalid shortcut: ${shortcut}`);
    }
    // determine which part is the currency
    let quantity, currency;

    const numeric1 = utils.looksNumeric(parts[0]);
    const numeric2 = utils.looksNumeric(parts[1]);

    if (parts.length === 3) {
      if (!utils.startsWithCarat(parts[2])) {
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

  equals(entry) {
    return entry &&
      R.is(Entry, entry) &&
      this.quantity.eq(entry.quantity) &&
      this.currency === entry.currency &&
      this.type === entry.type;
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
    return utils.stripFalsyExcept({
      id: this.id,
      quantity: this.quantity.toFixed(8),
      currency: this.currency,
      account: this.account,
      type: this.type,
      note: this.note,
    });
  }

  toString() {
    return `Entry ({$this.type}): ${this.quantity.toFixed(8)} ${this.currency} ^${this.account}`;
  }
}

/**
 * Parse an entire list of shortcut or object entries and return a list of Entries
 * @param {Array<Object|String}} entries
 * @param {Transaction} transaction parent
 */
export function makeEntries(entries, transaction) {
  return R.flatten(entries.map(entry => flexibleToEntries(entry, transaction)));
}

/**
 * Parses an one or more entries from a yaml-style "entry".
 * This means it may be:
 * - A string: shortcut
 * - An object: with one or both of "credits" or "debits" fields
 * @param {Object|String} raw object to parse
 * @return {Array<Entry>} List of entries parsed
 */
export function flexibleToEntries(raw, transaction) {
  if (utils.isString(raw)) {
    return shortcutToEntries(raw, transaction);
  }
  if (utils.isObject(raw)) {
    return objectToEntries(raw, transaction);
  }
  console.error('Invalid Entry', raw);
  throw new Error('Invalid Entry: cannot parse');
}

const hasCredits = R.has('credits');
const hasDebits = R.has('debits');

export function objectToEntries(raw, transaction) {
  /**
   * Parses a raw object with credits and/or debits array members
   * Pair posting: debit [@|=] credit
   * @param {String} shortcut
   * @return {Array<Entry>} list of entries
   * @example "10 BTC", "$ 10", "10 BTC @ $ 8000", "-10 ETH @ .03 BTC"
   */
  let entries = [];
  if (hasDebits(raw)) {
    entries = arrayToEntries(raw.debits, 'debit', transaction);
  }
  if (hasCredits(raw)) {
    entries = R.concat(entries, arrayToEntries(raw.credits, 'credit', transaction));
  }

  return entries;
}

/**
 * parses a list of entries, which may be objects or strings
 * @param {Array<Object|String} rawArray input
 * @param {String} entryType credit or debit
 */
export function arrayToEntries(rawArray, entryType, transaction) {
  return rawArray.map(entry => {
    const props = utils.isString(entry) ?
          {shortcut: entry, transaction, type: entryType}
          :
          {...entry, transaction, type: entryType};
    return new Entry(props);
  });
}

/**
 * Parses an entry "shortcut" into one or more Entries.
 * Shortcut can be in two forms:
 * Single posting: "number currency", "currency number"
 * Pair posting: debit [@|=] credit
 * @param {String} shortcut
 * @return {Object<string: Array<Posting>>} postings, keyed by "credits" and "debits"
 * @example "10 BTC", "$ 10", "10 BTC @ $ 8000", "-10 ETH @ .03 BTC"
 */
export function shortcutToEntries(raw_shortcut, transaction) {
  const parts = utils.splitAndTrim(raw_shortcut);
  // minimal shortcut: "10 BTC"
  if (parts.length < 2) {
    throw new Error(`Invalid shortcut: ${raw_shortcut}`);
  }

  const entries = [];

  let accum = [];
  let connector = '';
  let current;
  while (parts.length > 0) {
    current = parts.shift();
    if (!utils.isConnector(current)) {
      accum.push(current);
    } else {
      if (connector) {
        throw new Error(`Invalid shortcut, two connectors: ${raw_shortcut}`);
      }
      // must have enough in accumulator for current entry, and enough left to make another
      if (accum.length < 2 || parts.length < 2) {
        throw new Error(`Invalid shortcut: ${raw_shortcut} ${accum} ${parts}`);
      }
      entries.push(new Entry({shortcut: accum.join(' '), transaction}));
      connector = current;
      accum = [];
    }
  }
  if (accum.length < 2) {
    throw new Error(`Invalid shortcut: ${raw_shortcut}`);
  }
  const entry = new Entry({
    shortcut: accum.join(' '),
    transaction,
    type: connector ? 'credit' : 'debit'
  });
  if (connector === '@') {
    // if it was specified as price/each, then multiply by the amount we purchased
    entry.multiplyBy(entries[0]);
  }
  entries.push(entry);

  return entries;
}
