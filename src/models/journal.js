import * as R from 'ramda';
import * as RA from 'ramda-adjunct';

import Accounts from './accounts';
import Account from './account';
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
    this.accounts = new Accounts(merged.accounts);
    this.currencies = makeCurrencies(merged.currencies);
    this.transactions = makeTransactions(merged.transactions);
    this.checkAndApply();
  }

  /**
   * Test to see if sufficient information exists to fill in transaction
   * information, and do so if conditions are met.
   */
  checkAndApply() {
    const { accounts, transactions } = this;
    if (accounts && !accounts.isEmpty() && transactions && transactions.length > 0) {
      transactions.forEach((tx) => {
        tx.applyToAccounts(accounts);
      });
      accounts.createBalancingEntries();
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
    return this.accounts.get(key);
  }

  /**
   * Get balances for all accounts
   * @param {Function} filter to apply to entries
   * @return {object} balances keyed by account path
   */
  getBalancesByAccount(entryFilter) {
    let balances = {};
    this.accounts.forEach((account) => {
      balances = R.merge(balances, account.getBalancesByAccount(entryFilter));
    });
    return balances;
  }

  /**
   * Get balances of currencies, with account subtotals
   * @param {Function} filter to apply to entries
   * @param {Boolean} includeVirtual [default false] 
   * @return {Object} balances keyed by currency
   */
  getBalancesByCurrency(entryFilter, includeVirtual=false) {
    const { accounts } = this;
    const balances = {};
    const byAccount = this.getBalancesByAccount(entryFilter);

    Object.keys(byAccount).forEach((accountPath) => {
      const acct = accounts.get(accountPath);
      if (includeVirtual || !acct.isVirtual()) {
        const acctBal = byAccount[accountPath];
        Object.keys(acctBal).forEach((curr) => {
          const quantity = acctBal[curr];
          if (!quantity.eq(BIG_0)) {
            if (!R.has(curr, balances)) {
              balances[curr] = {quantity, accounts: {[accountPath]: quantity}};
            } else {
              balances[curr].quantity = balances[curr].quantity.plus(quantity);
              balances[curr].accounts[accountPath] = quantity;
            }
          }
        });
      }
    });

    return balances;
  }

  getLots(force) {
    return this.accounts.getLots(this.currencies, force)
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
