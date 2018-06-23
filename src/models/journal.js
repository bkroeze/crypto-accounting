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
    this.accounts = makeAccounts(merged.accounts);
    this.currencies = makeCurrencies(merged.currencies);
    this.transactions = makeTransactions(merged.transactions);
  }

  getAccount(key) {
    const path = key.split(':');
    let curr = this.accounts[path.shift()]
    while(path.length > 0 && curr) {
      curr = curr.children[path.shift()];
    }
    if (!curr) {
      throw new IndexError(`Account Not Found: ${key}`);
    }
    return curr;
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
