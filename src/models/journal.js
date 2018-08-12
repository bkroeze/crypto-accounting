const R = require('ramda');

const Accounts = require('./accounts');
const PriceHistory = require('./pricehistory');
const Transaction = require('./transaction');
const { makeCurrencies } = require('./currency');
const utils = require('../utils/models');
const { BIG_0 } = require('../utils/numbers');
const sets = require('../utils/sets');

/**
 * Default properties for new Journal instances
 */
const DEFAULT_PROPS = {
  id: null,
  name: null,
  accounts: {},
  currencies: {},
  transactions: [],
  pricehistory: null,
};

const KEYS = R.keysIn(DEFAULT_PROPS);
const getProps = R.pick(KEYS);

class Journal {
  /**
   * Construct using a `props` object.
   * @param {object} props
   */
  constructor(props) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    this.id = R.propOr(merged.name, 'id', merged);
    this.name = merged.name;
    this.accounts = new Accounts(merged.accounts);
    this.currencies = makeCurrencies(merged.currencies);
    this.transactions = Transaction.makeTransactions(merged.transactions);
    this.pricehistory = new PriceHistory(merged.pricehistory);
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
   * Generate a report showing helpful messages about aspects of the journal that may need fixing
   * for integrity and accuracy.
   * @return {Object<String, Array>} A report keyed by area.
   */
  getCleanliness() {
    return utils.stripFalsy({
      accounts: this.getCleanlinessOfAccounts(),
      currencies: this.getCleanlinessOfCurrencies(),
      transactions: this.getCleanlinessOfTransactions(),
    });
  }

  getCleanlinessOfAccounts() {
    const problems = [];
    const accountsUsed = sets.mergeSets(this.transactions.map(tx => tx.getAccounts()));
    accountsUsed.forEach(account => {
      if (!this.accounts.has(account)) {
        problems.push(`${account} not defined in accounts list`);
      }
    });
    return problems;
  }


  getCleanlinessOfCurrencies() {
    const problems = [];
    const currenciesUsed = sets.mergeSets(this.transactions.map(tx => tx.getCurrencies()));
    const currenciesAvailable = new Set(Object.keys(this.currencies));
    const currenciesMissing = sets.setDifference(currenciesUsed, currenciesAvailable);
    currenciesMissing.forEach(missing => {
      problems.push(`${missing} currency not defined in currencies list`);
    });
    return problems;
  }

  getCleanlinessOfTransactions() {
    const problems = [];
    this.transactions.forEach(tx => {
      if (!tx.isBalanced()) {
        problems.push(`Transaction ${tx.id} on ${tx.utc.toISODate()} is not balanced.`);
      }
    });
    return problems;
  }

  /**
   * Find the nearest price for the given currency pair
   * @param {String|Moment|Object} utc
   * @param {String} base currency
   * @param {String} quote currency - the rate refers to this many of this currency for 1 base
   * @param {Array} currencies to use as bases for derivation
   * @param {Integer} within seconds (no limit if not given or null)
   * @return {PairPrice}
   * @throws {RangeError} with code "ERR_DISTANCE" if nearest is out of range
   * @throws {RangeError} with code "ERR_NOT_FOUND" if pair is not present and cannot be derived
   */
  findPrice(utc, base, quote, transCurrencies = null, within = null) {
    const translations = transCurrencies || this.getTranslationCurrencies().map(R.prop('id'));
    return this.pricehistory.findPrice(utc, base, quote, translations, within);
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
  getBalancesByCurrency(entryFilter, includeVirtual = false) {
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
              balances[curr] = { quantity, accounts: { [accountPath]: quantity } };
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

  /**
   * Get the lots for this journal.
   * @param {boolean} force - always recalculate if true
   * @param {boolean} lifo - override default fifo ordering if true
   * @return {Array<Lot>} lots
   */
  getLots(force, lifo) {
    return this.accounts.getLots(this.currencies, force, lifo);
  }

  /**
   * Get lots for this journal as an object keyed by currency.
   * @param {boolean} force - always recalculate if true
   * @param {boolean} lifo - override default fifo ordering if true
   * @param {Object<String, Lot>} lots
   */
  getLotsByCurrency(force, lifo) {
    const lots = {};
    this.getLots(force, lifo).forEach((l) => {
      if (!R.has(l.currency, lots)) {
        lots[l.currency] = [l];
      } else {
        lots[l.currency].push(l);
      }
    });
    return lots;
  }

  /**
   * Get currencies noted as translation currencies in the Journal.
   * @return {Array<Currency>} translation currencies
   */
  getTranslationCurrencies() {
    return R.valuesIn(this.currencies).filter(c => c.translation);
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @return {Object<String, *>}
   */
  toObject(options = {}) {
    return utils.stripFalsyExcept({
      id: this.id,
      name: this.name,
      accounts: this.accounts.toObject(options),
      currencies: utils.objectValsToObject(this.currencies, options),
      transactions: utils.arrayToObjects(this.transactions, options),
      pricehistory: this.pricehistory.toObject(options),
    });
  }
}

module.exports = Journal;
