import * as R from 'ramda';

import Account from './account';
import Lot from './lot';
import { CREDIT, DEBIT } from './constants';
import * as utils from './modelUtils';
import { BIG_0 } from '../utils/numbers';

const fifoSearch = R.find;
const lifoSearch = R.findLast;

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

  getLots(currencies, force, lifo) {
    const search = lifo ? lifoSearch : fifoSearch;
    if (force || this.lots.length === 0) {
      const lots = R.flatten(this.map(a => a.getLots(currencies, force)));
      lots.sort(Lot.compare);
      // we've got lots, now go through credits for all accounts and apply

      const isTrade = (entry) => {
        if (entry.isBalancingEntry()) {
          return false;
        }
        const currency = currencies[entry.currency];
        //console.log(`isNotFiat: ${entry.currency}, ${currency ? 'found' : 'missing'}`);
        if (!currency || currency.isFiat()) {
          return false;
        }
        return entry.pair && entry.currency !== entry.pair.currency;
      };

      const applyCreditToLots = (c) => {
        const findLot = l => (l.currency === c.currency && l.isOpen());
        let qty = c.quantity;
        while (qty.gt(BIG_0)) {
          // console.log('-- qty now', qty.toFixed(2));
          const lot = search(findLot, lots);
          if (!lot) {
            throw new Error(`Ran out of lots looking for ${c.currency}`);
          }
          // console.log('going to add to', lot.toObject(true));
          const applied = lot.addCredit(c, qty);
          // console.log(`applied ${applied.toFixed(2)}`);
          qty = qty.minus(applied);
        }
      };

      this.asList()
        .filter(Account.isNotVirtualAccount)
        .forEach((a) => {
          a.getEntries(CREDIT)
            .filter(isTrade)
            .forEach(applyCreditToLots);
        });
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
