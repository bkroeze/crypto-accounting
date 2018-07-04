import * as utils from './modelUtils';

export default class Lot {

  constructor(debit) {
    debit.setLot(this);
    this.currency = debit.currency;
    this.debits = [debit];
    this.utc = debit.getUtc();
    this.total = debit.quantity;
  }

  /**
   * Tests a debit to see if it is a "lot" type entry.
   */
  static isLot(currencies, debit) {
    const curr = currencies[debit.currency];
    if (!curr || curr.fiatDefault) {
      return false;
    }

    return true;
  }

  static makeLots(currencies, debits) {
    const isLot = lot => Lot.isLot(currencies)
    return debits.filter(isLot).map(d => new Lot(d));
  }

  toObject(shallow) {
    return utils.stripFalsyExcept({
      currency: this.currency,
      debits: shallow ? null : this.debits.map(utils.toObject),
      utc: this.utc.toISOString(),
      total: this.total.toFixed(8),
    });
  }
}
