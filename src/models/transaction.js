/* eslint no-console: ["error", { allow: ["error"] }] */
const R = require('ramda');
const RA = require('ramda-adjunct');
const Moment = require('moment');
const Result = require('folktale/result');
const log = require('js-logger').get('models.transaction');
const Credit = require('./credit');
const Debit = require('./debit');
const utils = require('../utils/models');
const Parser = require('../utils/parser');
const { makeError } = require('../utils/errors');
const { calcHashId } = require('../utils/numbers');
const { CREDIT, DEBIT, ERRORS, SYMBOL_MAP } = require('./constants');

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
  trades: [],
  details: {},
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);
const allBalanced = R.all(e => e.isBalanced());
const getDebits = R.filter(R.propEq('type', DEBIT));
const getCredits = R.filter(R.propEq('type', CREDIT));
const getFees = R.filter(R.propEq('fee', true));

class Transaction {
  /**
   * Construct using a `props` object that must include "utc", and may also
   * include "notes", "tags", and a list of transactions
   * @param {object} props
   */
  constructor(props = {}) {
    this.errors = [];
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    const { trades, debits, credits, fees } = merged;

    if (R.has('account', merged) && RA.isString(merged.account)) {
      merged.account = { credit: merged.account, debit: merged.account };
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

    this.entries = [];

    const addEntryPair = (pair) => {
      this.entries.push(pair.credit);
      this.entries.push(pair.debit);
    };

    if (credits) {
      this.makeBalancedPairs(credits, true).forEach(addEntryPair);
    }
    if (debits) {
      this.makeBalancedPairs(debits, false).forEach(addEntryPair);
    }
    if (trades) {
      const tradeResults = this.makeTrades(trades);
      tradeResults[0].forEach(addEntryPair);
      if (tradeResults[1].length > 0) {
        this.errors = this.errors.concat(tradeResults[1]);
      }
    }

    if (fees) {
      this.makeBalancedPairs(fees, false).forEach((pair) => {
        pair.credit.setFee(true);
        pair.debit.setFee(true);
        addEntryPair(pair);
      });
    }

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

  getFees(ofType = null) {
    return ofType ? R.filter(R.propEq('type', ofType), getFees(this.entries))
      : getFees(this.entries);
  }

  /**
   * Get all trade pairs from entries.
   */
  getTradePairs() {
    return this.getDebits().filter(entry => entry.isTrade()).map(entry => ({
      credit: entry.pair,
      debit: entry,
    }));
  }

  /**
   * Test whether all debits in this transaction are balanced.
   */
  isBalanced() {
    return allBalanced(this.getDebits());
  }

  makeBalancedPair(shortcut, isCredit, leadingSymbolMap) {
    const parser = new Parser(leadingSymbolMap);
    return parser.parseEntry(shortcut)
      .chain(({ entry, comment }) => {
        const accountShortcut = entry.join(' ');
        const noAccountShortcut = entry.slice(0, 2).join(' '); // strip the account and comment, if any
        let credit;
        let debit;
        if (isCredit) {
          credit = new Credit({ shortcut: accountShortcut, transaction: this });
          debit = new Debit({ shortcut: noAccountShortcut, transaction: this, note: comment });
        } else {
          credit = new Credit({ shortcut: noAccountShortcut, transaction: this });
          debit = new Debit({ shortcut: accountShortcut, transaction: this, note: comment });
        }
        debit.setPair(credit, '=');
        return Result.Ok({ credit, debit });
      });
  }

  makeBalancedPairs(rawArray, isCredit, leadingSymbolMap = SYMBOL_MAP) {
    const results = rawArray.map(
      shortcut => this.makeBalancedPair(shortcut, isCredit, leadingSymbolMap)
    );
    this.errors = this.errors.concat(
      results.filter(x => x instanceof Result.Error).map(x => x.merge())
    );

    return results.filter(x => x instanceof Result.Ok).map(x => x.merge());
  }

  makeTrades(rawArray, leadingSymbolMap = SYMBOL_MAP) {
    const parser = new Parser(leadingSymbolMap);
    const trades = [];
    const errors = [];
    const transaction = this;

    const makeCredit = (value) => {
      const [quantity, currency, account] = value.credit;
      return new Credit({ quantity, currency, transaction, account });
    };

    const makeDebit = (value) => {
      const [quantity, currency, account] = value.debit;
      return new Debit({ quantity, currency, transaction, account, note: value.comment });
    };

    rawArray.forEach((shortcut) => {
      parser.parseTrade(shortcut)
        .matchWith({
          Ok: ({ value }) => {
            const credit = makeCredit(value);
            const debit = makeDebit(value);
            if (value.connector === '@') {
              // if parser reversed the trade sides because of a leading "-", make sure
              // to adjust quantity appropriately
              if (value.reversed) {
                debit.quantity = debit.quantity.times(credit.quantity);
              } else {
                credit.quantity = credit.quantity.times(debit.quantity);
              }
            }
            debit.setPair(credit, value.connector);
            trades.push({ credit, debit });
          },
          Error: ({ value }) => {
            log.error(value);
            errors.push(value);
          },
        });
    });
    return [trades, errors];
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
    const trades = this.getTradePairs().map(pair => ({
      credit: pair.credit.toObject(options),
      debit: pair.debit.toObject(options),
    }));
    return utils.stripFalsy({
      id: this.id,
      note: this.note,
      account: this.account,
      status: this.status,
      utc: options.byDay ? this.utc.format('YYYY-MM-DD') : this.utc.toISOString(),
      address: this.address,
      party: this.party,
      tags: this.tags,
      credits: this.getCredits().map(t => t.toObject(options)),
      debits: this.getDebits().map(t => t.toObject(options)),
      trades,
      fees: this.getFees().map(t => t.toObject(options)),
      details: this.details,
    });
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
    const trades = this.getTradePairs();
    const credits = this.getCredits().filter(entry => !entry.isTrade());
    const debits = this.getDebits().filter(entry => !entry.isTrade());

    KEYS.forEach((key) => {
      if (R.has(key, data)) {
        const prefix = work.length === 0 ? '-' : ' ';
        const val = data[key];
        if (key === 'credits' || key === 'debits') {
          const entries = (key === 'credits' ? credits : debits);

          if (entries && entries.length > 0) {
            work.push(`${prefix} ${key}:`);
            entries.forEach((entry) => {
              try {
                work.push(`    - ${entry.getFullShortcut(this)}`);
              } catch (e) {
                throw new Error(`Not a ${key}: ${JSON.stringify(entry)} ${typeof entry}`);
              }
            });
          }
        } else if (key === 'trades') {
          if (trades && trades.length > 0) {
            work.push(`${prefix} ${key}:`);
            trades.forEach((entry) => {
              try {
                work.push(`    - ${entry.debit.getFullShortcut(this)}`);
              } catch (e) {
                throw new Error(`Not a trade: ${JSON.stringify(entry)}`);
              }
            });
          }
        } else if (key === 'tags') {
          if (val && val.length > 0) {
            work.push(`${prefix} tags:`);
            val.forEach((tag) => {
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
