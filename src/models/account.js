/* eslint no-console: ["error", { allow: ["error"] }] */
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';

import * as utils from './modelUtils';

const INHERIT = '%INHERIT%';

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
  return e.type === 'debit' ? e.quantity : e.quantity.times(-1);
}

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
  if (a.type === 'debit' && b.type === 'credit') {
    return 1;
  }
  if (a.type === 'credit' && b.type === 'debit') {
    return -1;
  }
  return 0;
}

export default class Account {
  /**
   * Construct using a `props` object that must include "path", and may also
   * include "name" and "notes"
   * @param {object} props
   */
  constructor(props = {}) {
    this.dirty = {
      entries: false,
    };
    this.entries = []; // not constructed using "props" at this point
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
      throw new Error('Invalid Account, must have a path');
    }
    if (this.parent) {
      this.path = `${this.parent.path}:${this.path}`;
    }

    this.children = Account.makeChildAccounts(this, children);
  }

  static hasBalancingAccount(account) {
    return !!account.getBalancingAccount();
  }

  static isVirtualAccount(account) {
    return account.isVirtual();
  }

  static isNotVirtualAccount(account) {
    return !account.isVirtual();
  }

  static makeChildAccounts(parent, children) {
    const accounts = {};
    R.keysIn(children).forEach((path) => {
      const child = children[path];
      accounts[path] = new Account(R.merge(child, { parent, path }));
    });
    return accounts;
  }

  addEntry(entry) {
    entry.addIndex = this.entries.length;
    this.entries.push(entry);
    this.dirty.entries = true;
  }

  /**
   * Create virtual "balancing" entries (debits) for virtual accounts to bring
   * the total books to 0
   * @param {Account} account which will get the balancing entries
   * @throws {ReferenceError} if balancing account is not found
   */
  createBalancingEntries(balancingAccount) {
    try {
      if (!balancingAccount) {
        return false;
      }
      const entries = this.getEntries();
      entries.forEach((entry)=> {
        if (!entry.balancing && (!entry.pair || entry.currency !== entry.pair.currency)) {
          //console.log(`Adding balancing ${this.path} -> ${balancingAccount.path}`);
          //console.log(`entry: ${JSON.stringify(entry.toObject(), null, 2)}`);
          balancingAccount.addEntry(entry.makeBalancingClone(balancingAccount));
        }
      });
    } catch (e) {
      if (R.is(ReferenceError, e)) {
        console.log(e);
        throw new ReferenceError(`Cannot find balancing account ${this.getBalancingAccount()}`);
      }
      throw e;
    }
  }

  /**
   * Get a child account
   */
  getAccount(key) {
    let path = R.clone(key);
    if (RA.isString(path)) {
      path = path.split(':');
    }
    const nextChild = path.shift();
    let child = this.children[nextChild];
    if (!child) {
      throw new ReferenceError(`Account Not Found: ${this.path}:${nextChild}`);
    }
    if (path.length > 0) {
      child = child.getAccount(path);
    }
    return child;
  }

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
    }
    if (!ofType) {
      return this.entries;
    }
    return this.entries.filter(R.propEq('type', ofType));
  }

  /**
   * Get current balance of each currency.
   * @param {function) filter to apply to the entries
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

  getBalancesByAccount(entryFilter) {
    let balances = {};
    balances[this.path] = this.getBalances(entryFilter);
    Object.values(this.children).forEach((child) => {
      balances = R.merge(balances, child.getBalancesByAccount(entryFilter));
    });
    return balances;
  }

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

  isVirtual() {
    if (this.virtual === INHERIT) {
      if (this.parent) {
        return this.parent.isVirtual();
      }
      return false;
    }
    return this.virtual;
  }

  toObject() {
    return utils.stripFalsyExcept({
      path: this.path,
      aliases: this.aliases,
      balancing_account: this.balancingAccount,
      note: this.note,
      tags: this.tags,
      portfolio: this.portfolio,
      children: utils.objectValsToObject(this.children),
      entries: this.entries.map(utils.toObject),
      virtual: this.virtual === INHERIT ? null : this.virtual,
      details: this.details,
    });
  }

  toString() {
    return `Currency: ${this.id}`;
  }
}
