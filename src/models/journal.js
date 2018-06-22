import * as R from 'ramda';

import Account, {makeAccounts} from './account';
import Transaction, {makeTransactions} from './transaction';
import Currency, {makeCurrencies} from './currency';
import * as utils from './modelUtils';

const DEFAULT_PROPS = {
  id: null,
  accounts: [],
  currencies: [],
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
}
