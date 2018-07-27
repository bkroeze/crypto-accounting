import Moment from 'moment';
import * as R from 'ramda';
import Entry from './entry';
import * as utils from '../utils/models';
import { DEBIT } from './constants';
import { addBigNumbers, BIG_0 } from '../utils/numbers';

const getApplied = R.map(R.prop('applied'));

function makeCreditObjects(wrappers) {
  return wrappers.map(wrapper => ({
    ...wrapper.credit.toObject(true),
    applied: wrapper.applied.toFixed(8),
  }));
}

function makeDebitObjects(wrappers) {
  return wrappers.map(wrapper => ({
    ...wrapper.debit.toObject(true),
    applied: wrapper.applied.toFixed(8),
  }));
}

export default class Lot {
  /**
   * Instantiate the lot with its first debit.
   * @param {Entry} debit
   */
  constructor(debit) {
    this.account = debit.getAccount();
    this.currency = debit.currency;
    this.debits = [];
    this.credits = [];
    this.utc = debit.getUtc();
    this.addDebit(debit);
  }

  /**
   * Sort function for lots
   * @param {Lot} a
   * @param {Lot} b
   * @param {Integer} -1, 0, 1
   */
  static compare(a, b) {
    const utcA = Moment(a.utc);
    const utcB = Moment(b.utc);
    if (utcA.isBefore(utcB)) {
      return -1;
    }
    if (utcB.isBefore(utcA)) {
      return 1;
    }
    if (a.currency < b.currency) {
      return -1;
    }
    if (a.currency > b.currency) {
      return 1;
    }
    return 0;
  }

  /**
   * Tests a debit to see if it is a "lot" type entry.
   * @param {Object<String,Currency>} currencies
   * @param {Entry} debit
   * @return {Boolean} true if the debit should be in a lot
   */
  static isLot(currencies, debit) {
    if (debit.type !== DEBIT) {
      return false;
    }
    const curr = currencies[debit.currency];
    if (!curr || curr.isFiat()) {
      return false;
    }
    if (debit.balancing) {
      // console.log('debit is lot', debit.toObject(true));
      return true;
    }

    return false;
  }

  /**
   * Create lots from a list of debits.
   * @param {Object<String,Currency>} currencies
   * @param {Array<Entry>} debits
   * @return {Array<Lot>} lots
   */
  static makeLots(currencies, debits) {
    const isLot = lot => Lot.isLot(currencies, lot);
    return debits
      .filter(isLot)
      .map(d => new Lot(d));
  }

  /**
   * Add a credit to this lot.
   * @param {Entry} credit
   * @param {BigNumber} max to apply
   * @return {BigNumber} amount applied
   */
  addCredit(credit, maxQuantity) {
    const applied = credit.setLot(this, maxQuantity);
    if (applied.gt(BIG_0)) {
      this.credits.push({ credit, applied });
    }
    return applied;
  }

  /**
   * Add a credit to this lot.
   * @param {Entry} debit
   * @return {BigNumber} amount remaining to be applied in lot
   */
  addDebit(debit) {
    const applied = debit.setLot(this, debit.quantity);
    if (applied.gt(BIG_0)) {
      this.debits.push({ debit, applied });
    }
    return this.getRemaining();
  }

  /**
   * Get the effective price each on the purchase date.
   * @param {PriceHistory} pricehistory
   * @param {String} currency for the price
   * @param {Array<String>} list of currencies to use as translations
   * @param {Integer} seconds to search for dates within
   * @return {BigNumber} price
   */
  getPurchasePriceEach(pricehistory, fiat, transCurrencies = ['BTC', 'ETH'], within = null) {
    const { debit } = this.debits[0];
    const credit = debit.pair;
    const eachPrice = credit.quantity.div(debit.quantity);
    if (credit.currency === fiat) {
      // easy, purchase price is the "each" price of the credit
      return eachPrice;
    }
    const translation = pricehistory.findPrice(
      this.utc, credit.currency, fiat, transCurrencies, within
    );
    // console.log('got translation', translation.toObject());
    return translation.rate.times(eachPrice);
  }

  /**
   * Get the effective price each on the sale date.
   * @param {Entry} credit
   * @param {PriceHistory} pricehistory
   * @param {String} currency for the price
   * @param {Array<String>} list of currencies to use as translations
   * @param {Integer} seconds to search for dates within
   * @return {BigNumber} price
   */
  static getSalePriceEach(credit, pricehistory, fiat, transCurrencies = ['BTC', 'ETH'], within = null) {
    const debit = credit.pair;
    const eachPrice = debit.quantity.div(credit.quantity);
    if (debit.currency === fiat) {
      return eachPrice;
    }
    const translation = pricehistory.findPrice(
      credit.getUtc(), debit.currency, fiat, transCurrencies, within
    );
    return translation.rate.times(eachPrice);
  }

  /**
   * Calculate capital gains entries from exercised credits.
   * @param {PriceHistory} pricehistory
   * @param {String} account path to use for gains entries
   * @param {String} currency for the price
   * @param {Array<String>} list of currencies to use as translations
   * @param {Integer} seconds to search for dates within
   * @return {Array<Entry>} list of debits representing capital gains
   */
  getCapitalGains(pricehistory, account, fiat, transCurrencies = ['BTC', 'ETH'], within = null) {
    const purchasePrice = this.getPurchasePriceEach(pricehistory, fiat, transCurrencies, within);
    return this.credits.map((creditWrapper) => {
      const { credit, applied } = creditWrapper;
      const salePrice = Lot.getSalePriceEach(
        credit, pricehistory, fiat, transCurrencies, within
      );
      const profitEach = salePrice.minus(purchasePrice);
      /* console.log(`profitEach (${salePrice.toFixed(2)}
         -${purchasePrice.toFixed(2)})
         * ${applied.toFixed()}
         = ${profitEach.toFixed(2)}`); */
      return new Entry({
        transaction: credit.transaction,
        account,
        currency: fiat,
        quantity: profitEach.times(applied),
        virtual: true,
        type: DEBIT,
      });
    });
  }

  /**
   * Get the remaining part of this lot not yet applied to credits.
   * @return {BigNumber} quantity remaining
   */
  getRemaining() {
    return this.getTotal().minus(this.getUsed());
  }

  /**
   * Get the total amount of credits applied to this lot.
   * @return {BigNumber} quantity applied
   */
  getTotal() {
    return addBigNumbers(getApplied(this.debits));
  }

  /**
   * Get unrealized gains for a specified date.
   * @param {String|Moment} utc search date
   * @param {PriceHistory} pricehistory
   * @param {String} account path to use for gains entries
   * @param {String} currency for the price
   * @param {Array<String>} list of currencies to use as translations
   * @param {Integer} seconds to search for dates within
   * @return {Entry} debits representing unrealized capital gains
   */
  getUnrealizedGains(utc, pricehistory, account, currency, transCurrencies = ['BTC', 'ETH'], within = null) {
    let quantity = BIG_0;
    const remaining = this.getRemaining();
    if (remaining.gt(BIG_0)) {
      const purchasePrice = this.getPurchasePriceEach(
        pricehistory, currency, transCurrencies, within
      );
      const translation = pricehistory.findPrice(
        utc, this.currency, currency, transCurrencies, within
      );
      const currentPrice = translation.rate;

      const profitEach = currentPrice.minus(purchasePrice);
      quantity = profitEach.times(remaining);
    }

    const { debit } = this.debits[0];
    return new Entry({
      transaction: debit.transaction,
      account,
      quantity,
      currency,
      virtual: true,
      type: DEBIT,
    });
  }

  /**
   * Get the total amount of credits applied to this lot.
   * @return {BigNumber} total applied
   */
  getUsed() {
    return addBigNumbers(getApplied(this.credits));
  }

  /**
   * Test whether all debits have been used.
   * @return {Boolean} true if used up
   */
  isClosed() {
    return this.getRemaining().eq(BIG_0);
  }

  /**
   * Test whether all debits have not been used.
   * @return {Boolean} true if not used up
   */
  isOpen() {
    return this.getRemaining().gt(BIG_0);
  }

  /**
   * Get a representation of this object useful for logging or converting to yaml
   * @param {Boolean} shallow - reduce output of child objects if true
   * @return {Object<String, *>}
   */
  toObject(shallow) {
    return utils.stripFalsyExcept({
      account: this.account,
      currency: this.currency,
      credits: shallow ? null : makeCreditObjects(this.credits),
      debits: shallow ? null : makeDebitObjects(this.debits),
      utc: this.utc.toISOString(),
      total: this.getTotal().toFixed(8),
      used: this.getUsed().toFixed(8),
      remaining: this.getRemaining().toFixed(8),
    }, ['account']);
  }
}
