/* eslint no-param-reassign: off */
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';
import * as utils from '../utils/models';
import { CREDIT, DEBIT, INHERIT, ERRORS } from './constants';
import { makeError } from '../utils/errors';
import { Lot } from './lot';

const DEFAULT_PROPS = {
  path: '',
  balancing_account: '',
  aliases: [],
  note: '',
  tags: [],
  portfolio: '',
  parent: null,
  children: {},
  virtual: '%INHERIT%',
  details: {}, // additional key-value pairs
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);

function getBalanceQty(e) {
  return e.type === DEBIT ? e.quantity : e.quantity.times(-1);
}

/**
 * Extends the sort for entry to include its insertion order, for more stable sorts.
 */
function entrySorter(a, b) {
  const utcA = a.getUtc();
  const utcB = b.getUtc();
  if (utcA.isBefore(utcB)) {
    return -1;
  }
  if (utcA.isAfter(utcB)) {
    return 1;
  }
  if (a.addIndex < b.addIndex) {
    return -1;
  }
  if (a.addIndex > b.addIndex) {
    return 1;
  }
  if (a.type === DEBIT && b.type === CREDIT) {
    return 1;
  }
  if (a.type === CREDIT && b.type === DEBIT) {
    return -1;
  }
  return 0;
}

export class Account {
  /**
   * Construct using a `props` object that must include "path", and may also
   * include "name" and "notes"
   * @param {object} props
   * @Throws {TypeError} if 'path' param is missing
   */
  constructor(props = {}) {
    this.dirty = {
      entries: true,
      lots: true,
    };
    this.entries = []; // not constructed using "props" at this point
    this.lots = [];
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    let children = [];

    KEYS.forEach((key) => {
      const val = merged[key];
      if (key === 'children') {
        children = val;
      } else if (key === 'balancing_account' && val !== '') {
        this.balancingAccount = val;
      } else {
        this[key] = val;
      }
    });

    if (!this.path) {
      console.error(`Invalid Account, must have a path, got: ${JSON.stringify(props)}`);
      throw makeError(
        TypeError,
        ERRORS.MISSING_PARAMETER,
        'Invalid Account, must have a path'
      );
    }
    if (this.parent) {
      this.path = `${this.parent.path}:${this.path}`;
    }

    this.children = Account.makeChildAccounts(this, children);
  }

  /**
   * Test if an account is a balancing account.
   * @param {Account} account
   * @return {Boolean} true if balancing
   */
  static hasBalancingAccount(account) {
    return !!account.getBalancingAccount();
  }

  /**
   * Test if an account is a virtual account.
   * @param {Account} account
   * @return {Boolean} true if virtual
   */
  static isVirtualAccount(account) {
    return account.isVirtual();
  }

  /**
   * Test if an account is not a virtual account.
   * @param {Account} account
   * @return {Boolean} true if not a virtual account
   */
  static isNotVirtualAccount(account) {
    return !account.isVirtual();
  }

  /**
   * Create a set of child accounts for a parent.
   * @param {Account} parentfacc
   * @param {Array<Account>} children
   * @return {Object<String, Account>} accounts keyed by path
   */
  static makeChildAccounts(parent, children) {
    const accounts = {};
    R.keysIn(children).forEach((path) => {
      const child = children[path];
      accounts[path] = new Account(R.merge(child, { parent, path }));
    });
    return accounts;
  }

  /**
   * Add an entry to the account entries.
   * @param {Entry} entry
   * @return {Accounts} this object
   */
  addEntry(entry) {
    entry.addIndex = this.entries.length;
    this.entries.push(entry);
    this.dirty.entries = true;
    return this;
  }

  /**
   * Create virtual "balancing" entries (debits) for virtual accounts to bring
   * the total books to 0
   * @param {Account} account which will get the balancing entries
   * @throws {ReferenceError} if balancing account is not found
   * @return {Accounts} this object
   */
  createBalancingEntries(balancingAccount) {
    try {
      if (!balancingAccount) {
        return false;
      }
      const entries = this.getEntries();
      entries.forEach((entry) => {
        if (!entry.balancing && (!entry.pair || entry.currency !== entry.pair.currency)) {
          // console.log(`Adding balancing ${this.path} -> ${balancingAccount.path}`);
          // console.log(`entry: ${JSON.stringify(entry.toObject(), null, 2)}`);
          balancingAccount.addEntry(entry.makeBalancingClone(balancingAccount));
        }
      });
    } catch (e) {
      if (R.is(ReferenceError, e)) {
        console.error(e);
        throw makeError(
          ReferenceError,
          ERRORS.MISSING_ACCOUNT,
          `Cannot find balancing account ${balancingAccount}`
        );
      }
      throw e;
    }
    return this;
  }

  /**
   * Get a child account.
   * @param {String} key
   * @return {Account} account
   * @throws {ReferenceError} if child not found
   */
  getAccount(key) {
    let path = R.clone(key);
    if (RA.isString(path)) {
      path = path.split(':');
    }
    const nextChild = path.shift();
    let child = this.children[nextChild];
    if (!child) {
      throw makeError(
        ReferenceError,
        ERRORS.MISSING_ACCOUNT,
        `Account Not Found: ${this.path}:${nextChild}`
      );
    }
    if (path.length > 0) {
      child = child.getAccount(path);
    }
    return child;
  }

  /**
   * Gets the balancing account path if directly or indirectly set via parent.
   * @return {String} path, empty if not found
   */
  getBalancingAccount() {
    if (this.balancingAccount) {
      return this.balancingAccount;
    }
    if (this.parent) {
      return this.parent.getBalancingAccount();
    }
    return '';
  }

  /**
   * Get sorted entries.
   * @param {String} typename for filter, no filtering if not given
   * @return {Array<Entry>} Entries
   */
  getEntries(ofType) {
    if (this.dirty.entries) {
      this.entries.sort(entrySorter);
      this.dirty.entries = false;
      this.dirty.lots = true;
      this.lots = null;
    }
    const { entries } = this;
    if (!entries) {
      return [];
    }
    if (R.isEmpty(entries)) {
      return [];
    }
    if (!ofType) {
      return entries;
    }
    return entries.filter(e => e.type === ofType);
  }

  /**
   * Lazily get all lots from all accounts
   * @param {Object<String,Currency>} currencies
   * @param {Boolean} force recalculation if true
   * @return {Array<Lot>} lots
   */
  getLots(accounts, currencies, force) {
    if (this.isVirtual() || this.isExpense()) {
      return [];
    }
    if (this.dirty.lots || force) {
      const debits = this.getEntries(DEBIT);
      this.lots = Lot.makeLots(accounts, currencies, debits);
      // console.log('made lots:', this.lots.map(l => l.toObject({shallow: true})));
    }
    return this.lots;
  }

  /**
   * Get current balance of each currency.
   * @param {function} filter to apply to the entries
   * @return {Object<String, BigNumber>} balances keyed by currency
   */
  getBalances(entryFilter) {
    const balances = {};
    let entries = this.getEntries();
    if (RA.isFunction(entryFilter)) {
      entries = entries.filter(entryFilter);
    }
    entries.forEach((e) => {
      const qty = getBalanceQty(e);
      if (!R.has(e.currency, balances)) {
        balances[e.currency] = qty;
      } else {
        balances[e.currency] = balances[e.currency].plus(qty);
      }
    });
    return balances;
  }

  /**
   * Get current balance for each account
   * @param {function} filter to apply to the entries
   * @return {Object<String, BigNumber>} balances keyed by account path
   */
  getBalancesByAccount(entryFilter) {
    let balances = {};
    balances[this.path] = this.getBalances(entryFilter);
    Object.values(this.children).forEach((child) => {
      balances = R.merge(balances, child.getBalancesByAccount(entryFilter));
    });
    return balances;
  }

  getPathDepth() {
    return this.path.split(':').length - 1;
  }

  getLastPath() {
    return R.last(this.path.split(':'));
  }

  /**
   * Get Total balances, keyed by currency
   * @param {function} filter to apply to the entries
   * @return {Object<String, BigNumber>} balances keyed by currency
   */
  getTotalBalances(entryFilter) {
    const balances = this.getBalances(entryFilter);
    Object.values(this.children).forEach((child) => {
      const childBalances = child.getTotalBalances(entryFilter);
      Object.keys(childBalances).forEach((currency) => {
        if (!R.has(currency, balances)) {
          balances[currency] = childBalances[currency];
        } else {
          balances[currency] = balances[currency].plus(childBalances[currency]);
        }
      });
    });
    return balances;
  }

  /**
   * Test path to see if this account matches, or any of its parents.
   * @param {String} path
   * @return {Boolean} true if this or parent matches
   */
  inPath(path) {
    if (this.path === path) {
      return true;
    }
    if (this.parent) {
      return this.parent.inPath(path);
    }
    return false;
  }

  isExpense() {
    return (this.parent && this.parent.isExpense())
      || R.startsWith('expense', this.path.toLowerCase())
      || R.has('fee', this.tags)
      || R.has('expense', this.tags);
  }

  isIncome() {
    return R.startsWith('income', this.path.toLowerCase())
      || R.has('income', this.tags);
  }

  /**
   * Test if this account is virtual or descended from a virtual parent
   * @return {Boolean} true if virtual
   */
  isVirtual() {
    if (this.virtual === INHERIT) {
      if (this.parent) {
        return this.parent.isVirtual();
      }
      return false;
    }
    return this.virtual;
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @return {Object<String, *>}
   */
  toObject(options = {}) {
    const props = {
      path: this.path,
      aliases: this.aliases,
      balancing_account: this.balancingAccount,
      note: this.note,
      tags: this.tags,
      portfolio: this.portfolio,
      children: utils.objectValsToObject(this.children, options),
      virtual: this.virtual === INHERIT ? null : this.virtual,
      details: this.details,
    };

    if (!options.yaml) {
      props.entries = utils.arrayToObjects(this.entries, options);
    }


    return utils.stripFalsyExcept(props);
  }

  toString() {
    return `Account: ${this.path}`;
  }
}
