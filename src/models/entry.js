/* eslint prefer-destructuring: ["error", { array: false }] */
const R = require('ramda');
const RA = require('ramda-adjunct');
const Moment = require('moment');
const BigNumber = require('bignumber.js');
const log = require('js-logger').get('cryptoaccounting.models.entry');
const utils = require('../utils/models');
const Parser = require('../utils/parser');
const { makeError } = require('../utils/errors');
const { BIG_0, addBigNumbers, calcHashId } = require('../utils/numbers');
const { CREDIT, DEBIT, ERRORS, SYMBOL_MAP } = require('./constants');

const commaRe = new RegExp(/,/, 'g');

function describeLots(wrappers) {
  return wrappers.map(wrapper => ({
    ...wrapper.lot.toObject(),
    applied: wrapper.applied.toFixed(8),
  }));
}

const mergeProps = props => ({
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
  trade: null,
  balancing: null, // the other entry in a balancing pair
  virtual: false,
  fee: false,
  ...props,
});

const KEYS = R.keysIn(mergeProps({}));
const getProps = R.pick(KEYS);
const hasCredits = R.has('credits');
const hasDebits = R.has('debits');
const hasEntries = R.has('entries');
const isCredit = R.propEq('type', 'credit');
const isDebit = R.propEq('type', 'debit');

function getLotCredits(currency, lots) {
  return lots
    .filter(R.propEq('currency', currency))
    .map(R.prop('applied'));
}

class Entry {
  /**
   * Construct using a `props` object that must include the parent transaction
   * @param {String|Object} shortcut string, or full object
   * @throws {TypeError} if props cannot be parsed
   */
  constructor(props = { }) {
    const work = RA.isString(props) ? { shortcut: props } : props;
    const merged = mergeProps(getProps(work));
    if (!merged.transaction) {
      console.error(`Invalid Entry, must have a 'transaction', got: ${JSON.stringify(props)}`);
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        'Invalid Entry, must have a parent transaction'
      );
    }

    if (merged.shortcut && (merged.currency || merged.amount)) {
      console.error(`Invalid Entry, can't specify a shortcut and currency/amount: ${JSON.stringify(props)}`);
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        'Invalid Entry, conflicting shortcut'
      );
    }

    const leadingSymbolMap = props.leadingSymbolMap || SYMBOL_MAP;

    KEYS.forEach((key) => {
      this[key] = merged[key];
    });

    if (merged.shortcut) {
      this.applyShortcut(merged.shortcut, leadingSymbolMap);
    }

    if (R.isNil(this.quantity)) {
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        'Invalid Entry, no Quantity'
      );
    }

    // doesn't hurt to re-wrap if it isn't already a BigNumber
    this.quantity = new BigNumber(this.quantity);
    if (!this.id) {
      this.id = calcHashId({
        ...this.toObject({ shallow: true }),
        transactionId: this.transaction.id,
        shortcut: this.shortcut,
      });
    }

    if (!this.shortcut) {
      this.shortcut = `${merged.quantity} ${this.currency}`;
    }

    const account = this.getAccount();
    if (R.endsWith(` ${account}`, this.shortcut)) {
      this.shortcut = this.shortcut.slice(0, -account.length).trim();
    }
  }

  /**
   * parses a list of entries, which may be objects or strings
   * @param {Array<Object|String} rawArray input
   * @param {String} entryType credit or debit
   */
  static arrayToEntries(rawArray, entryType, transaction) {
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

  /**
   * Parses a raw object with credits and/or debits array members
   * Pair posting: debit [@|=] credit
   * @param {String} shortcut
   * @return {Array<Entry>} list of entries
   * @example "10 BTC", "$ 10", "10 BTC @ $ 8000", "-10 ETH @ .03 BTC"
   */
  static objectToEntries(raw, transaction) {
    let debits = [];
    let credits = [];
    if (hasEntries(raw)) {
      credits = raw.entries.filter(isCredit);
      debits = raw.entries.filter(isDebit);
    }

    if (hasDebits(raw)) {
      debits = R.concat(debits, raw.debits);
    }
    if (hasCredits(raw)) {
      credits = R.concat(credits, raw.credits);
    }

    if (debits) {
      debits = Entry.arrayToEntries(debits, DEBIT, transaction);
    }

    if (credits) {
      credits = Entry.arrayToEntries(credits, CREDIT, transaction);
    }

    return R.concat(debits, credits);
  }

  /**
   * Parse and apply the shortcut to this object.
   * @param {String} shortcut
   * @param {Map} leadingSymbols to use, defaulting to {'$': 'USD', '£': 'GBP', '€': EUR'}
   */
  applyShortcut(shortcut, leadingSymbolMap = SYMBOL_MAP) {
    const parser = new Parser(leadingSymbolMap);
    parser.parseEntry(shortcut)
      .matchWith({
        Ok: ({ value }) => {
          const { entry, comment } = value;
          const [quantity, currency, account] = entry;
          this.quantity = BigNumber(quantity.replace(commaRe, ''));
          this.currency = currency;
          if (comment) {
            this.note = comment;
          }
          if (account) {
            this.account = account;
          }
        },
        Error: ({ value }) => {
          log.error('Could not apply shortcut', value);
          this.error = value;
        },
      });
  }

  /**
   * Add this entry to the correct account.
   * @param {Accounts} Accounts
   * @return {Account} account for this entry
   */
  applyToAccount(accounts) {
    let acct;
    try {
      acct = accounts.get(this.getAccountPath());
      acct.addEntry(this);
    } catch (e) {
      if (e.message === ERRORS.NOT_FOUND) {
        console.error(`Warning, invalid journal, missing account ${this.getAccountPath()}`);
      }
    }
    return acct;
  }

  compare(entry) {
    const dateA = Moment(this.getUtc());
    const dateB = Moment(entry.getUtc());
    if (dateA.isBefore(dateB)) {
      return -1;
    }
    if (dateB.isBefore(dateA)) {
      return 1;
    }
    if (isCredit(this) && isDebit(entry)) {
      return -1;
    }
    if (isDebit(this) && isCredit(entry)) {
      return 1;
    }
    if (this.currency < entry.currency) {
      return -1;
    }
    if (this.currency > entry.currency) {
      return 1;
    }
    if (this.quantity.lt(entry.quantity)) {
      return -1;
    }
    if (this.quantity.gt(entry.quantity)) {
      return 1;
    }
    return 0;
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

  /**
   * Get the account for this entry, defaulting to the transaction account for this
   * type if not directly set.
   * @return {Account} Account
   */
  getAccount() {
    return this.account || this.transaction.account[this.type];
  }

  /**
   * Return the account path
   * @throws {TypeError} if none
   */
  getAccountPath() {
    const account = this.getAccount();
    if (!account) {
      console.error('no account!', this);
      throw makeError(
        TypeError,
        ERRORS.INVALID_SHORTCUT,
        'invalid account path'
      );
    }
    if (RA.isString(account)) {
      return account;
    }
    return account.path;
  }

  /**
   * Get the amount remaining of this credit, not yet applied to lots.
   * @return {BigNumber} amount remaining
   */
  getLotCreditRemaining() {
    if (this.TYPE === DEBIT) {
      return BIG_0;
    }

    const credits = addBigNumbers(getLotCredits(this.currency, this.lots));
    return this.quantity.minus(credits);
  }

  /**
   * An entry is a "trade" if it was exchanged for a different currency
   */
  isTrade() {
    return (this.pair && this.pair.currency !== this.currency);
  }

  /**
   * Get a shortcut for this entry.  If it is a debit and a trade then add that to the shortcut.
   */
  getFullShortcut(transaction = this) {
    const parts = this.shortcut.split(' ').slice(0, 2);
    if (this.account && this.account !== transaction.account[this.type]) {
      parts.push(this.account);
    }
    if (this.type === DEBIT && this.isTrade()) {
      parts.push(this.connector);
      this.pair.shortcut
        .split(' ')
        .slice(0, 2)
        .forEach((part) => { parts.push(part); });

      if (this.pair.account && this.pair.account !== transaction.account[this.pair.type]) {
        parts.push(this.pair.account);
      }
    }
    return parts.join(' ');
  }

  /**
   * Get the date for this entry, defaulting to the transaction date if not direcly set.
   * @return {Moment} date
   */
  getUtc() {
    return this.transaction.utc;
  }

  /**
   * Apply as much as possible of our remaining credit amount to the specified lot.
   * @param {Lot} lot
   * @param {BigNumber} maximum to apply
   * @return {BigNumber} how much was applied to the lot
   */
  setLot(lot, maxQuantity) {
    let applied = this.quantity;
    if (this.type === CREDIT) {
      const remainingLot = lot.getRemaining();
      const remainingCredit = this.getLotCreditRemaining();
      applied = BigNumber.min(remainingCredit, remainingLot, maxQuantity);
      /* console.log(`rl = ${remainingLot.toFixed(2)}
         rc = ${remainingCredit.toFixed(2)}
         max = ${maxQuantity.toFixed(2)}
         ap = ${applied}`); */
    }
    if (applied.gt(BIG_0)) {
      this.lots.push({ lot, applied });
    }
    return applied;
  }

  /**
   * Test whether this entry is in the specified account or one of its parents.
   * @param {String} path
   * @return {Boolean} true if found
   */
  inAccount(path) {
    const acct = this.getAccount();
    if (RA.isString(acct)) {
      return RA.contained(acct.split(':'), path);
    }
    return acct.inPath(path);
  }

  /**
   * Test whether this entry has a proper balancing entry.
   * @return {Boolean} true if balanced
   */
  isBalanced() {
    return !!(this.pair && (
      this.pair.currency !== this.currency
        || this.pair.getAccount() !== this.getAccount()
    ));
  }

  /**
   * Test whether this is a balancing entry.
   * @return {Boolean} true if balancing
   */
  isBalancingEntry() {
    return this.balancing && this.virtual;
  }

  isDebit() {
    return isDebit(this);
  }

  /**
   * Make a balancing pair entry.
   * @param {Account} account
   * @return {Entry} new pair entry
   */
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

  setFee(state) {
    this.fee = state;
  }

  /**
   * Set the "other side" of the entry on this and its partner.
   * @param {Entry} other side (credit if this is debit, debit if this is credit)
   * @param {Boolean} true if the price is specified as "per each"
   * @param {Trade}
   */
  setPair(partner, connector, trade = null) {
    this.connector = connector;
    this.pair = partner;
    this.trade = trade;
    if (partner.pair !== this) {
      partner.setPair(this, connector, trade);
    }
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @param {options} object with optional "shallow" and "yaml" fields
   * @return {Object<String, *>}
   */
  toObject(options = {}) {
    const { shallow, yaml } = options;
    const props = {
      id: this.id,
      quantity: this.quantity.toFixed(8),
      currency: this.currency,
      account: this.getAccountPath(),
      type: this.type,
      note: this.note,
      virtual: this.virtual,
      fee: this.fee,
    };

    if (!yaml) {
      props.pair = (!this.pair || shallow) ? null
        /* otherwise */: this.pair.toObject({ yaml, shallow: true });
      props.balancing = (!this.balancing || shallow) ? null
        /* otherwise */ : this.balancing.toObject({ yaml, shallow: true });
      props.lots = shallow ? null
        /* otherwise */ : describeLots(this.lots);
    }

    return utils.stripFalsy(props);
  }

  toString() {
    return `Entry (${this.type}): ${this.quantity.toFixed(8)} ${this.currency} ${this.getAccount()}`;
  }
}

module.exports = Entry;
