import Moment from 'moment';
import * as R from 'ramda';
import Entry from './entry';
import * as utils from '../utils/models';
import { CREDIT, DEBIT } from './constants';
import { addBigNumbers, BIG_0 } from '../utils/numbers';

const getApplied = R.map(R.prop('applied'));

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
      //console.log('debit is lot', debit.toObject(true));
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
      this.credits.push({credit, applied});
    }
    return applied;
  }

  addDebit(debit) {
    const applied = debit.setLot(this, debit.quantity);
    if (applied.gt(BIG_0)) {
      this.debits.push({debit, applied});
    }
    return this.getRemaining();
  }

  /**
   * Calculate capital gains entries from exercised credits.
   */
  getCapitalGains(pricehistory, account, fiat, transCurrencies=['BTC', 'ETH'], within=null) {
    const purchasePrice = pricehistory.findPrice(this.utc, this.currency, fiat, transCurrencies, within);
    return this.credits.map(creditWrapper => {
      const {credit, applied} = creditWrapper;
      //const salePrice = utcPrice(credit.utc);
      const ratio = credit.quantity.eq(applied) ? 1 : credit.quantity.div(applied);
      const salePrice = credit.pair.quantity.times(ratio);
      // this assumes that the pair currency is fiat
      // need to correct for that.
//       console.log('--------------');
//       console.log(credit.toObject());
//       console.log(`qty: ${credit.quantity}
// purchasePrice: ${purchasePrice.rate.toFixed(2)}
// salePrice: ${salePrice}
// applied: ${applied}
// `);
      return new Entry({
        transaction: credit.transaction,
        account,
        currency: fiat,
        quantity: salePrice.minus(purchasePrice.rate.times(applied)),
        type: DEBIT,
      });
    });
  }

  getPurchasePrice(getPrice, account, fiat, transCurrencies=['BTC', 'ETH']) {
    return getPrice(this.utc, this.currency, fiat, transCurrencies);
  }

  getRemaining() {
    return this.getTotal().minus(this.getUsed());
  }

  getTotal() {
    return addBigNumbers(getApplied(this.debits));
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

function makeCreditObjects(wrappers) {
  return wrappers.map((wrapper) => {
    return {
      ...wrapper.credit,
      applied: wrapper.applied.toFixed(8),
    }
  });
}

function makeDebitObjects(wrappers) {
  return wrappers.map((wrapper) => {
    return {
      ...wrapper.debit,
      applied: wrapper.applied.toFixed(8),
    }
  });
}
