import Moment from 'moment';
import * as R from 'ramda';
import * as utils from './modelUtils';

export default class Lot {

  constructor(debit) {
    debit.setLot(this);
    this.account = debit.getAccount();
    this.currency = debit.currency;
    this.debits = [debit];
    this.utc = debit.getUtc();
    this.total = debit.quantity;
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
    if (debit.type !== 'debit') {
      return false;
    }
    const curr = currencies[debit.currency];
    if (!curr || curr.fiatDefault) {
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

  toObject(shallow) {
    return utils.stripFalsyExcept({
      account: this.account,
      currency: this.currency,
      debits: shallow ? null : this.debits.map(utils.toShallowObject),
      utc: this.utc.toISOString(),
      total: this.total.toFixed(8),
    }, ['account']);
  }
}
