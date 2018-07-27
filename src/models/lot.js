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
  constructor(debit) {
    this.account = debit.getAccount();
    this.currency = debit.currency;
    this.debits = [];
    this.credits = [];
    this.utc = debit.getUtc();
    this.addDebit(debit);
  }

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

  static makeLots(currencies, debits) {
    const isLot = lot => Lot.isLot(currencies, lot);
    return debits
      .filter(isLot)
      .map(d => new Lot(d));
  }

  addCredit(credit, maxQuantity) {
    const applied = credit.setLot(this, maxQuantity);
    if (applied.gt(BIG_0)) {
      this.credits.push({ credit, applied });
    }
    return applied;
  }

  addDebit(debit) {
    const applied = debit.setLot(this, debit.quantity);
    if (applied.gt(BIG_0)) {
      this.debits.push({ debit, applied });
    }
    return this.getRemaining();
  }

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
        type: DEBIT,
      });
    });
  }

  getPurchasePrice(getPrice, account, fiat, transCurrencies = ['BTC', 'ETH']) {
    return getPrice(this.utc, this.currency, fiat, transCurrencies);
  }

  getRemaining() {
    return this.getTotal().minus(this.getUsed());
  }

  getTotal() {
    return addBigNumbers(getApplied(this.debits));
  }

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
      type: DEBIT,
    });
  }

  getUsed() {
    return addBigNumbers(getApplied(this.credits));
  }

  isClosed() {
    return this.getRemaining().eq(BIG_0);
  }

  isOpen() {
    return this.getRemaining().gt(BIG_0);
  }

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
