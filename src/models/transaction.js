/* eslint no-console: ["error", { allow: ["error"] }] */
const R = require('ramda');
const RA = require('ramda-adjunct');
const Moment = require('moment');
const Entry = require('./entry');
const Credit = require('./credit');
const Debit = require('./debit');
const utils = require('../utils/models');
const { makeError } = require('../utils/errors');
const { calcHashId } = require('../utils/numbers');
const { CREDIT, DEBIT, ERRORS, SYMBOL_MAP } = require('./constants');

// stub out fee descriptors
const makeFees = fees => fees;

const DEFAULT_PROPS = {
  id: '',
  account: { credit: '', debit: '' },
  status: '',
  party: '',
  address: '',
  utc: '',
  note: '',
  fees: [],
  tags: [],
  entries: [],
  debits: [],
  credits: [],
  details: {},
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);
const allBalanced = R.all(e => e.isBalanced());
const getDebits = R.filter(R.propEq('type', DEBIT));
const getCredits = R.filter(R.propEq('type', CREDIT));

class Transaction {
  /**
   * Construct using a `props` object that must include "utc", and may also
   * include "notes", "tags", and a list of transactions
   * @param {object} props
   */
  constructor(props = {}) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    const { trades, debits, credits, entries, fees } = merged;

    if (R.has('account', merged) && RA.isString(merged.account)) {
      merged.account = {credit: merged.account, debit: merged.account};
    }

    KEYS.forEach((key) => {
      if (key !== 'debits' && key !== 'credits' && key !== 'entries') {
        this[key] = merged[key];
      }
    });

    if (!this.utc) {
      console.error(`Invalid Transaction, must have a 'utc', got: ${JSON.stringify(props)}`);
      throw makeError(
        TypeError,
        ERRORS.INVALID_TERM,
        'Invalid Transaction, must have a utc'
      );
    }
    this.utc = Moment(this.utc);

    // TODO: remove
    this.entries = Entry.makeEntries(entries, this);

    if (credits) {
      this.makeBalancedPairs(credits, true).forEach(pair => {
        this.entries.push(pair.credit);
        this.entries.push(pair.debit);
      });
    }
    if (debits) {
      this.makeBalancedPairs(debits, false).forEach(pair => {
        this.entries.push(pair.credit);
        this.entries.push(pair.debit);
      });
    }

    // TODO: add makeTrades
    this.fees = makeFees(fees);
    if (!this.id) {
      this.id = calcHashId(this.toObject());
    }
  }

  /**
   * Create transactions from a raw list
   * @param {Array<Object>} raw transaction objections
   * @return {Array<Transaction>} transactions
   */
  static makeTransactions(raw) {
    return raw.map(tx => new Transaction(tx));
  }

  /**
   * Applies all entries to their correct accounts.
   * @param {Accounts} accounts
   * @return {Transaction} this transaction
   */
  applyToAccounts(accounts) {
    this.entries.forEach(e => e.applyToAccount(accounts));
    return this;
  }

  /**
   * Apply a function to all entries.
   * @param {Function} function to apply
   */
  forEach(fn) {
    if (fn) {
      this.entries.forEach(fn);
    }
  }

  getAccounts() {
    return new Set(this.map(e => e.getAccountPath()));
  }

  /**
   * Get all credits from this transaction entries
   * @return {Array<Entry} Credits
   */
  getCredits() {
    return getCredits(this.entries);
  }

  /**
   * Get the set of all currencies used in this transaction
   */
  getCurrencies() {
    return new Set(this.map(R.prop('currency')));
  }

  /**
   * Get all debits from this transaction entries
   * @return {Array<Entry} Debits
   */
  getDebits() {
    return getDebits(this.entries);
  }

  /**
   * Test whether all debits in this transaction are balanced.
   */
  isBalanced() {
    return allBalanced(this.getDebits());
  }

  makeBalancedPair(shortcut, isCredit, leadingSymbolMap) {
    const tokens = Entry.tokenizeShortcut(shortcut, leadingSymbolMap);
    const accountShortcut = tokens.join(' ');
    const noAccountShortcut = tokens.slice(0, 2).join(' '); // strip the account and comment, if any

    let credit;
    let debit;
    if (isCredit) {
      credit = new Credit({shortcut: noAccountShortcut, transaction: this});
      debit = new Debit({shortcut: accountShortcut, transaction: this});
      credit.setPair(debit, false);
    } else {
      credit = new Credit({shortcut: accountShortcut, transaction: this})
      debit = new Debit({shortcut: noAccountShortcut, transaction: this});
      debit.setPair(credit, false);
    }
    return {credit, debit};
  }

  makeBalancedPairs(rawArray, isCredit, leadingSymbolMap = SYMBOL_MAP) {
    return rawArray.map(shortcut => this.makeBalancedPair(shortcut, isCredit, leadingSymbolMap));
  }

  /**
   * Apply a function to all entries.
   * @param {Function} function to apply
   * @return {Array} result of function application
   */
  map(fn) {
    if (!fn) {
      return this.entries;
    }
    return this.entries.map(fn);
  }

  size() {
    return this.entries.length;
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @param {Object} options "byDay", "yaml", "shallow"
   * @return {Object<String, *>}
   */
  toObject(options = {}) {
    return utils.stripFalsyExcept({
      id: this.id,
      note: this.note,
      account: this.account,
      status: this.status,
      utc: options.byDay ? this.utc.format('YYYY-MM-DD') : this.utc.toISOString(),
      address: this.address,
      party: this.party,
      tags: this.tags,
      entries: this.entries.map(t => t.toObject(options)),
      fees: this.fees, // change to this.fees.map(f => t.toObject()) when unstub
      details: this.details,
    }, ['entries']);
  }

  toString() {
    return `Transaction: ${this.account} ${this.utc.toISOString} [${this.entries.length} entries]`;
  }

  /**
   * Convert a transaction object to its yaml representation
   * @param {Boolean} byDay if bucketed
   * @return {String} YAML representation
   */
  toYaml(byDay) {
    // TODO: split entries into trades, credits, debits
    const data = this.toObject({byDay});
    const work = [];
    KEYS.forEach((key) => {
      if (R.has(key, data)) {
        const prefix = work.length === 0 ? '-' : ' ';
        let val = data[key];
        if (key === 'entries') {
          if (val && val.length > 0) {
            work.push(`${prefix} entries:`);
            this.getDebits().forEach((entry) => {
              work.push(`    - ${entry.getFullShortcut()}`);
            });
          }
        } else if (key === 'tags') {
          if (val && val.length > 0) {
            work.push(`${prefix} tags:`)
            val.forEach((tag) => {
              work.push(`    - ${tag}`);
            });
          }
        } else if (key === 'account') {
          work.push(`${prefix} account: ${val.credit}`)
        } else {
          work.push(`${prefix} ${key}: ${val}`);
        }
      }
    });
    work.push('');
    return work.join('\n');
  }
}

module.exports = Transaction;
