/* eslint no-console: ["error", { allow: ["error"] }] */
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';
import BigNumber from 'bignumber.js';
import * as utils from '../utils/models';
import { BIG_0, addBigNumbers, isNegativeString, positiveString } from '../utils/numbers';
import { CREDIT, DEBIT } from './constants';

const DEFAULT_PROPS = {
  id: null,
  transaction: null,
  quantity: null,
  currency: '',
  account: '',
  lots: [],
  type: DEBIT,
  note: '',
  shortcut: '',
  pair: null,
  balancing: null,    // the other entry in a balancing pair
  virtual: false,
};

const KEYS = R.keysIn(DEFAULT_PROPS);
const getProps = R.pick(KEYS);
const hasCredits = R.has('credits');
const hasDebits = R.has('debits');

function getLotCredits(currency, lots) {
  return lots
    .filter(R.propEq('currency', currency))
    .map(R.prop('applied'));
}

export default class Entry {
  /**
   * Construct using a `props` object that must include the parent transaction
   * @param {object} props
   */
  constructor(props = { }) {
    const work = RA.isString(props) ? { shortcut: props } : props;
    const merged = R.merge(DEFAULT_PROPS, getProps(work));

    if (!merged.transaction) {
      console.error(`Invalid Entry, must have a 'transaction', got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Entry, must have a parent transaction');
    }

    if (merged.shortcut && (merged.currency || merged.amount)) {
      console.error(`Invalid Entry, can't specify a shortcut and currency/amount: ${JSON.stringify(props)}`);
      throw new Error('Invalid Entry, conflicting shortcut');
    }

    KEYS.forEach((key) => {
      this[key] = merged[key];
    });

    if (merged.shortcut) {
      this.applyShortcut(merged.shortcut);
    }

    if (R.isNil(this.quantity)) {
      throw new Error('Invalid Entry, no Quantity');
    }

    // doesn't hurt to re-wrap if it isn't already a BigNumber
    this.quantity = new BigNumber(this.quantity);
  }

  applyShortcut(shortcut) {
    const parts = utils.splitAndTrim(shortcut);
    // minimal shortcut: "10 BTC"
    if (parts.length !== 2 && parts.length !== 3) {
      throw new Error(`Invalid shortcut: ${shortcut}`);
    }
    // determine which part is the currency
    let quantity;
    let currency;

    const numeric1 = utils.looksNumeric(parts[0]);
    const numeric2 = utils.looksNumeric(parts[1]);

    if (parts.length === 3) {
      this.account = parts[2];
    }

    if (numeric1 && numeric2) {
      throw new Error(`Invalid Posting, two numeric in shortcut: ${shortcut}`);
    }

    if (!(numeric1 || numeric2)) {
      throw new Error(`Invalid Posting, no numeric in shortcut: ${shortcut}`);
    }

    if (numeric1) {
      [quantity, currency] = parts;
    } else {
      [currency, quantity] = parts;
    }
    this.quantity = BigNumber(quantity);
    this.currency = currency;
  }

  applyToAccount(accounts) {
    const acct = accounts.get(this.getAccountPath());
    acct.addEntry(this);
  }

  equals(entry) {
    return (
      entry
        && R.is(Entry, entry)
        && this.quantity.eq(entry.quantity)
        && this.currency === entry.currency
        && this.type === entry.type
    );
  }

  getAccount() {
    return this.account || this.transaction.account[this.type];
  }

  getAccountPath() {
    const account = this.getAccount();
    if (!account) {
      console.error('no account!', this);
      throw new Error('invalid account path');
    }
    if (RA.isString(account)) {
      return account;
    }
    return account.path;
  }

  getLotCreditRemaining() {
    if (this.TYPE === DEBIT) {
      return BIG_0;
    }

    const credits = addBigNumbers(getLotCredits(this.currency, this.lots));
    return this.quantity.minus(credits);
  }

  getUtc() {
    return this.transaction.utc;
  }

  setLot(lot, maxQuantity) {
    let applied = this.quantity;
    if (this.type === CREDIT) {
      const remainingLot = lot.getRemaining();
      const remainingCredit = this.getLotCreditRemaining();
      applied = BigNumber.min(remainingCredit, remainingLot, maxQuantity);
      //console.log(`rl = ${remainingLot.toFixed(2)} rc = ${remainingCredit.toFixed(2)} max = ${maxQuantity.toFixed(2)} ap = ${applied}`);
    }
    if (applied.gt(BIG_0)) {
      this.lots.push({lot, applied});
    }
    return applied;
  }

  inAccount(path) {
    const acct = this.getAccount();
    if (RA.isString(acct)) {
      return RA.contained(acct.split(':'), path);
    }
    return acct.inPath(path);
  }

  isBalanced() {
    return !!(this.pair && (
      this.pair.currency !== this.currency
        || this.pair.getAccount() !== this.getAccount()
    ));
  }

  isBalancingEntry() {
    return this.balancing && this.virtual;
  }

  makeBalancingClone(account) {
    this.balancing = new Entry({
      transaction: this.transaction,
      quantity: this.quantity,
      currency: this.currency,
      account: account.path,
      type: this.type === CREDIT ? DEBIT : CREDIT,
      balancing: this,
      virtual: true,
    });
    return this.balancing;
  }

  /**
   * Multiplies the current quantity by the quantity in the passed `Posting`.
   * @param {Posting} posting
   * @return {Posting} this
   */
  multiplyBy(posting) {
    this.quantity = this.quantity.times(posting.quantity);
    return this;
  }

  setPair(partner, priceEach) {
    this.pair = partner;
    if (priceEach) {
      // price specified as 'each', so it needs to be multiplied by
      // this quantity
      partner.multiplyBy(this);
    }
    if (partner.pair !== this) {
      // set the partnet, but don't multiply
      partner.setPair(this, false);
    }
  }

  toObject(shallow) {
    return utils.stripFalsyExcept({
      id: this.id,
      quantity: this.quantity.toFixed(8),
      currency: this.currency,
      account: this.getAccountPath(),
      type: this.type,
      pair: (!this.pair || shallow) ? null : this.pair.toObject(true),
      balancing: (!this.balancing || shallow) ? null : this.balancing.toObject(true),
      lots: shallow ? null : describeLots(this.lots),
      note: this.note,
      virtual: this.virtual,
    });
  }

  toString() {
    return `Entry (${this.type}): ${this.quantity.toFixed(8)} ${this.currency} ${this.getAccount()}`;
  }
}

function describeLots(wrappers) {
  return  wrappers.map((wrapper) => {
    return {
      ...wrapper.lot,
      applied: wrapper.applied.toFixed(8),
    }
  });
}

/**
 * parses a list of entries, which may be objects or strings
 * @param {Array<Object|String} rawArray input
 * @param {String} entryType credit or debit
 */
export function arrayToEntries(rawArray, entryType, transaction) {
  return rawArray.map((entry) => {
    let props;
    if (RA.isString(entry)) {
      props = { shortcut: entry, transaction, type: entryType };
    } else {
      props = { ...entry, transaction, type: entryType };
    }
    return new Entry(props);
  });
}

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
    entries = arrayToEntries(raw.debits, DEBIT, transaction);
  }
  if (hasCredits(raw)) {
    entries = R.concat(entries, arrayToEntries(raw.credits, CREDIT, transaction));
  }

  return entries;
}

/**
 * Parses an entry "shortcut" into balanced Entries.
 * Shortcut can be in three forms:
 * - Single posting (credit): "quantity currency [account]"
 *   which will have a balancing debit created for it using the transaction debit account.
 * - Single posting (debit): "= quantity currency [account]"
 * - Pair posting: debit [@|=] credit
 *
 * @param {String} shortcut
 * @return {Object<string: Array<Posting>>} postings, keyed by "credits" and "debits"
 * @example "10 BTC", "$ 10", "10 BTC @ $ 8000", "-10 ETH @ .03 BTC"
 */
export function shortcutToEntries(rawShortcut, transaction) {
  const parts = utils.splitAndTrim(rawShortcut);
  // minimal shortcut: "10 BTC"
  if (parts.length < 2) {
    throw new Error(`Invalid shortcut: ${rawShortcut}`);
  }

  let accum = [];
  let connector = '';
  let current;
  let shortcuts = [];

  while (parts.length > 0) {
    current = parts.shift();
    if (!utils.isConnector(current)) {
      accum.push(current);
    } else {
      if (accum.length > 0) {
        shortcuts.push(accum);
      }
      connector = current;
      accum = [];
    }
  }
  if (accum.length < 2) {
    throw new Error(`Invalid shortcut: ${rawShortcut}`);
  }
  shortcuts.push(accum);

  if (shortcuts.length === 1) {
    if (connector !== '=') {
      // insert a debit at the front, without a specified account
      // this allows the default action to be from and to the same account
      // but if one is specified, then that is the credit account.
      shortcuts = [shortcuts[0].slice(0, 2), shortcuts[0]];
      connector = '=';
    } else {
      // a leading "=" connector means that this single-entry is a debit
      // so add a matching credit.
      shortcuts = [shortcuts[0], shortcuts[0].slice(0,2)];
    }

  }
  let ix = 0;
  let debit;
  let credit;
  const entries = [];
  while (ix < shortcuts.length) {
    let debitIx = ix;
    let creditIx = ix + 1;

    const firstAmount = shortcuts[debitIx][0];
    const negativeFirst = isNegativeString(firstAmount);
    if (negativeFirst) {
      // this is a credit, not a debit
      // take the positive value
      shortcuts[debitIx][0] = positiveString(firstAmount);
      // and swap the shortcuts
      debitIx = ix + 1;
      creditIx = ix;
    }

    debit = new Entry({
      shortcut: shortcuts[debitIx].join(' '),
      transaction,
      type: DEBIT,
    });
    credit = new Entry({
      shortcut: shortcuts[creditIx].join(' '),
      transaction,
      type: CREDIT,
    });

    if (negativeFirst) {
      credit.setPair(debit, connector === '@');
    } else {
      debit.setPair(credit, connector === '@');
    }
    entries.push(debit);
    entries.push(credit);
    ix += 2;
  }
  return entries;
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
  if (RA.isString(raw)) {
    return shortcutToEntries(raw, transaction);
  }
  if (RA.isObj(raw)) {
    return objectToEntries(raw, transaction);
  }
  console.error('Invalid Entry', raw);
  throw new Error('Invalid Entry: cannot parse');
}

/**
 * Parse an entire list of shortcut or object entries and return a list of Entries
 * @param {Array<Object|String}} entries
 * @param {Transaction} transaction parent
 */
export function makeEntries(entries, transaction) {
  return R.flatten(entries.map(entry => flexibleToEntries(entry, transaction)));
}
