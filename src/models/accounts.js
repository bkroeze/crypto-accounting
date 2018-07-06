import * as R from 'ramda';

import Account from './account';
import Lot from './lot';
import * as utils from './modelUtils';

/**
 * Get all accounts, keyed by full path
 * @param {Object<String, Account>} accounts
 * @return {Object<String, Account>} map
 */
function getAccountPathMap(accounts) {
  let pathMap = {};

  R.valuesIn(accounts).forEach((account) => {
    pathMap[account.path] = account;
    if (!R.isEmpty(account.children)) {
      pathMap = R.merge(pathMap, getAccountPathMap(account.children));
    }
  });
  return pathMap;
}

export default class Accounts {
  constructor(accounts) {
    this.accounts = accounts;
    this.lots = [];
    R.keysIn(accounts).forEach((path) => {
      accounts[path] = new Account(R.merge(accounts[path], { path }));
    });
    this.aliases = {};
    this.paths = {};
  }

  asList() {
    if (R.isEmpty(this.paths)) {
      this.calculatePaths();
    }
    const keys = R.keysIn(this.paths);
    keys.sort();
    return keys.map(k => this.paths[k]);
  }

  calculatePaths() {
    this.paths = getAccountPathMap(this.accounts);
    let aliases = {};

    R.valuesIn(this.paths).forEach((account) => {
      if (account.aliases) {
        account.aliases.forEach(a => {
          aliases[a] = account;
        });
      }
    });
    this.aliases = aliases;
  }

  createBalancingEntries() {
    if (R.isEmpty(this.paths)) {
      this.calculatePaths();
    }
    this.getBalancing().forEach(account => {
      try {
        const balancingAccount = this.get(account.getBalancingAccount());
        account.createBalancingEntries(balancingAccount);
      } catch (e) {
        console.error(`${e.message}\nAccounts: ${Object.keys(this.paths)}`);
        throw e;
      }
    })
  }

  /**
   * Get a list of all accounts and subaccounts matching the filter, in a flat list
   * @param {Function} filter
   */
  filter(accountFilter) {
    const accounts = this.asList();
    if (!accountFilter) {
      return accounts;
    }
    return accounts.filter(accountFilter);
  }

  forEach(fn) {
    Object.values(this.accounts).forEach(fn);
  }

  get(key) {
    const path = (R.is(Array, key)) ? key.join(':') : key;
    let val = this.getAlias(path);
    if (!val) {
      val = this.getPath(path);
    }
    if (!val) {
      throw new ReferenceError(path);
    }
    return val;
  }

  getAlias(alias) {
    if (R.isEmpty(this.aliases)) {
      this.calculatePaths();
    }
    return this.aliases[alias];
  }

  getBalancing() {
    return this.filter(Account.hasBalancingAccount)
  }

  getLots(currencies, force) {
    if (force || this.lots.length === 0) {
      const lots = R.flatten(this.map(a => a.getLots(currencies, force)));
      lots.sort(Lot.compare);
      this.lots = lots;
    }
    return this.lots;
  }

  getPath(path) {
    if (R.isEmpty(this.paths)) {
      this.calculatePaths();
    }
    return this.paths[path];
  }

  isEmpty() {
    return R.isEmpty(this.accounts);
  }

  /**
   * Apply a function to all accounts.
   * @param {Function} filter
   */
  map(fn) {
    const accounts = this.asList();
    if (!fn) {
      return accounts;
    }
    return accounts.map(fn);
  }

  toObject() {
    return utils.objectValsToObject(this.accounts);
  }
}
