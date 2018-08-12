/* eslint no-console: ["error", { allow: ["error"] }] */
const R = require('ramda');
const RA = require('ramda-adjunct');
const Moment = require('moment');

const { makeEntries } = require('./entry');
const utils = require('../utils/models');
const { makeError } = require('../utils/errors');
const { calcHashId } = require('../utils/numbers');
const { CREDIT, DEBIT, ERRORS } = require('./constants');

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
  details: {}
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
    const { entries, fees } = merged;

    KEYS.forEach(key => {
      if (key !== 'transactions' && key !== 'fees') {
        let val = merged[key];
        if (key === 'account' && RA.isString(val)) {
          val = { debit: val, credit: val };
        }
        this[key] = val;
      }
    });

    if (!this.utc) {
      console.error(`Invalid Transaction, must have a 'utc', got: ${JSON.stringify(props)}`);
      throw makeError(TypeError, ERRORS.INVALID_TERM, 'Invalid Transaction, must have a utc');
    }
    this.utc = Moment(this.utc);
    this.entries = makeEntries(entries, this);
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
      details: this.details
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
    const data = this.toObject({ byDay });
    const work = [];
    KEYS.forEach(key => {
      if (R.has(key, data)) {
        const prefix = work.length === 0 ? '-' : ' ';
        let val = data[key];
        if (key === 'entries') {
          if (val && val.length > 0) {
            work.push(`${prefix} entries:`);
            this.getDebits().forEach(entry => {
              work.push(`    - ${entry.getFullShortcut()}`);
            });
          }
        } else if (key === 'tags') {
          if (val && val.length > 0) {
            work.push(`${prefix} tags:`);
            val.forEach(tag => {
              work.push(`    - ${tag}`);
            });
          }
        } else if (key === 'account') {
          work.push(`${prefix} account: ${val.credit}`);
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
//# sourceMappingURL=transaction.js.map
