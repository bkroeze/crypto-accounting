import * as R from 'ramda';

import { makeAccounts } from './account';
import { makeTransactions } from './transaction';
import { makeCurrencies } from './currency';
import * as utils from './modelUtils';
import { BIG_0 } from '../utils/numbers';

const DEFAULT_PROPS = {
  id: null,
  accounts: {},
  currencies: {},
  transactions: [],
};

const KEYS = R.keysIn(DEFAULT_PROPS);
const getProps = R.pick(KEYS);

export default class Journal {
  /**
   * Construct using a `props` object from YAML
   * @param {object} props
   */
  constructor(props) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    this.id = merged.id;
    this.setAccounts(makeAccounts(merged.accounts));
    this.setCurrencies(makeCurrencies(merged.currencies));
    this.setTransactions(makeTransactions(merged.transactions));
  }

  /**
   * Test to see if sufficient information exists to fill in transaction
   * information, and do so if conditions are met.
   */
  checkAndApply() {
    if (this.transactions && this.transactions.length > 0 && !R.isEmpty(this.accounts)) {
      const getter = R.curry(utils.getAccount)(this.accounts);
      this.transactions.forEach((tx) => {
        tx.applyToAccounts(getter);
      });
    }
  }

  /**
   * Get an account from this Journal by following the key path, splitting on
   * colons.
   * @param {String} key such as "assets:banks"
   * @return {Account} account
   * @throws {ReferenceError} if account not found
   */
  getAccount(key) {
    if (key.indexOf(':') === -1) {
      const aliasMap = utils.getAccountAliasMap(this.accounts);
      if (R.has(key, aliasMap)) {
        return aliasMap[key];
      }
    }
    return utils.getAccount(this.accounts, key);
  }

  /**
   * Get balances for all accounts
   * @param {Function} filter to apply to entries
   * @return {object} balances keyed by account path
   */
  getBalancesByAccount(entryFilter) {
    let balances = {};
    Object.keys(this.accounts).forEach((account) => {
      balances = R.merge(balances, this.accounts[account].getBalancesByAccount(entryFilter));
    });
    return balances;
  }

  /**
   * Get balances of currencies, with account subtotals
   * @param {Function} filter to apply to entries
   * @return {Object} balances keyed by currency
   */
  getBalancesByCurrency(entryFilter) {
    const balances = {};
    const byAccount = this.getBalancesByAccount(entryFilter);
    const getter = R.curry(utils.getAccount)(this.accounts);

    Object.keys(byAccount).forEach((accountPath) => {
      const acct = getter(accountPath);
      const acctBal = byAccount[accountPath];
      Object.keys(acctBal).forEach((curr) => {
        const quantity = acctBal[curr];
        if (!quantity.eq(BIG_0)) {
          if (!R.has(curr, balances)) {
            balances[curr] = {quantity, accounts: [accountPath]};
          } else {
            balances[curr].quantity = balances[curr].quantity.plus(quantity);
            balances[curr].accounts.push(accountPath);
          }
        }
      });
    });

    return balances;
  }

  setAccounts(accounts) {
    this.accounts = accounts;
    this.checkAndApply();
  }

  setCurrencies(currencies) {
    this.currencies = currencies;
    // this.checkAndApply();
  }

  setTransactions(transactions) {
    this.transactions = transactions;
    this.checkAndApply();
  }

  toObject() {
    return utils.stripFalsyExcept({
      id: this.id,
      accounts: utils.objectValsToObject(this.accounts),
      currencies: utils.objectValsToObject(this.currencies),
      transactions: this.transactions.map(utils.toObject),
    });
  }
}
