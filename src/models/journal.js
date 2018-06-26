import * as R from 'ramda';

import Account, {makeAccounts} from './account';
import Transaction, {makeTransactions} from './transaction';
import Currency, {makeCurrencies} from './currency';
import * as utils from './modelUtils';

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

  checkAndApply() {
    if (this.transactions && this.transactions.length > 0 && !R.isEmpty(this.accounts)) {
      this.transactions.forEach(tx => {
        tx.applyToAccounts(this.getAccount);
      });
    }
  }

  getAccount = (key) => {
    let path = key;
    if (utils.isString(path)) {
      path = path.split(':');
    }
    let account = this.accounts[path.shift()];
    if (path.length) {
      account = account.getAccount(path);
    }
    if (!account) {
      throw new ReferenceError(`Account Not Found: ${key}`);
    }
    return account;
  }

  getBalancesByAccount() {
    let balances = {};
    Object.keys(this.accounts).forEach(account => {
      balances = R.merge(balances, this.accounts[account].getBalancesByAccount());
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
