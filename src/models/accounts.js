import * as R from 'ramda';
import { Account } from './account';
import { Lot } from './lot';
import { CREDIT, ERRORS } from './constants';
import * as utils from '../utils/models';
import { makeError } from '../utils/errors';
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

/**
 * A container class for a group of accounts.
 */
export class Accounts {
  /**
   * Constructor
   * @param {Array<Object>} accounts in raw 'props' format
   */
  constructor(accounts) {
    this.accounts = accounts;
    this.lots = [];
    R.keysIn(accounts).forEach((path) => {
      this.accounts[path] = new Account(R.merge(accounts[path], { path }));
    });
    this.aliases = {};
    this.paths = {};
  }

  /**
   * Lazily get all accounts as an array, sorted by path.
   * @return {Array<Account>} accounts
   */
  asList() {
    if (R.isEmpty(this.paths)) {
      this.calculatePaths();
    }
    const keys = R.keysIn(this.paths);
    keys.sort();
    return keys.map(k => this.paths[k]);
  }

  /**
   * Build the path account map, for faster lookup later.
   */
  calculatePaths() {
    this.paths = getAccountPathMap(this.accounts);
    const aliases = {};

    R.valuesIn(this.paths).forEach((account) => {
      if (account.aliases) {
        account.aliases.forEach((a) => {
          aliases[a] = account;
        });
      }
    });
    this.aliases = aliases;
    return this;
  }

  /**
   * Go through all balancing accounts, and create balancing (virtual) entries for them.
   */
  createBalancingEntries() {
    if (R.isEmpty(this.paths)) {
      this.calculatePaths();
    }
    this.getBalancing().forEach((account) => {
      try {
        const balancingAccount = this.get(account.getBalancingAccount());
        account.createBalancingEntries(balancingAccount);
      } catch (e) {
        console.error(`${e.message}\nAccounts: ${Object.keys(this.paths)}`);
        throw e;
      }
    });
    return this;
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

  /**
   * Apply a function to each account.
   * @param {Function } fn
   */
  forEach(fn) {
    Object.values(this.accounts).forEach(fn);
  }

  /**
   * Get an account by alias or key
   * @param {String} alias or key
   * @return {Account} account
   * @throws {ReferenceError} if not found
   */
  get(key) {
    const path = (R.is(Array, key)) ? key.join(':') : key;
    let val = this.getAlias(path);
    if (!val) {
      val = this.getPath(path);
    }
    if (!val) {
      throw makeError(
        ReferenceError,
        ERRORS.NOT_FOUND,
        path
      );
    }
    return val;
  }

  /**
   * Get an account by alias.
   * @param {String} alias
   * @return {Account} account
   */
  getAlias(alias) {
    if (R.isEmpty(this.aliases)) {
      this.calculatePaths();
    }
    return this.aliases[alias];
  }

  /**
   * Get all balancing accounts.
   * @return {Array<Account>} accounts
   */
  getBalancing() {
    return this.filter(Account.hasBalancingAccount);
  }

  /**
   * Lazily calculate all lots for all transactions in all accounts.
   * @param {Object<String,Currency>} currencies
   * @param {Boolean} force recalculation if true
   * @param {Boolean} lifo use lifo instead of the default fifo strategy if true
   * @return {Array<Lot>} lots
   */
  getLots(currencies, force, lifo) {
    const search = lifo ? lifoSearch : fifoSearch;
    if (force || this.lots.length === 0) {
      const lots = R.flatten(this.map(a => a.getLots(this, currencies, force)));
      // console.log({lots});
      lots.sort(Lot.compare);
      // we've got lots, now go through credits for all accounts and apply

      const isTradeOrFee = (entry) => {
        if (entry.isBalancingEntry()) {
          return false;
        }
        const currency = currencies[entry.currency];
        // console.log(`isNotFiat: ${entry.currency}, ${currency ? 'found' : 'missing'}`);
        if (!currency || currency.isFiat()) {
          return false;
        }

        return entry.fee || entry.isTrade();
      };

      const applyCreditToLots = (c) => {
        // if (c.currency === 'LTC') {
        //   console.log(`Starting applyCredit ${c.quantity.toFixed(8)} ${c.transaction.utc}`);
        // }
        const findLot = l => (l.currency === c.currency && l.isOpen());
        let qty = c.quantity;
        while (qty.gt(BIG_0)) {
          // if (c.currency === 'LTC') {
          //   console.log('-- qty now', qty.toFixed(8));
          // }
          const lot = search(findLot, lots);
          if (!lot) {
            throw makeError(RangeError, `${ERRORS.EXHAUSTED}, Ran out of lots looking for ${qty.toFixed(8)} ${c.currency}`, lots);
          }
          // if (c.currency === 'LTC') {
          //   console.log('going to add to', JSON.stringify(lot.toObject(), null, 2));
          // }
          const applied = lot.addCredit(c, qty);
          // if (c.currency === 'LTC') {
          //   console.log(`applied ${applied.toFixed(8)}`);
          //   console.log(`remaining ${lot.getRemaining().toFixed(8)}`);
          // }
          qty = qty.minus(applied);
        }
      };

      const credits = R.flatten(
        this.asList()
          .filter(Account.isNotVirtualAccount)
          .map(a => a.getEntries(CREDIT).filter(isTradeOrFee))
      );

      credits.sort((a, b) => a.compare(b));
      credits.forEach(applyCreditToLots);

      this.lots = lots;
    }
    return this.lots;
  }

  /**
   * Get an account by path.
   * @param {String} path
   * @return {Account} account
   */
  getPath(path) {
    if (R.isEmpty(this.paths)) {
      this.calculatePaths();
    }
    return this.paths[path];
  }

  has(path) {
    try {
      if (this.get(path)) {
        return true;
      }
    } catch (e) {
      // pass
    }
    return false;
  }

  /**
   * Check to see if it is populated.
   * return {Boolean} true if no accounts
   */
  isEmpty() {
    return R.isEmpty(this.accounts);
  }

  /**
   * Apply a function to all accounts.
   * @param {Function} function to apply
   */
  map(fn) {
    const accounts = this.asList();
    if (!fn) {
      return accounts;
    }
    return accounts.map(fn);
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
}   * @return {Object<String, Object>}
   */
  toObject(options = {}) {
    return utils.objectValsToObject(this.accounts, options);
  }
}
