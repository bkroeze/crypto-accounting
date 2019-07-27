import { Credit } from './credit';
import { Debit } from './debit';

const makeCredit = (value, transaction) => {
  const [quantity, currency, account] = value.credit;
  return new Credit({ quantity, currency, transaction, account });
};

const makeDebit = (value, transaction) => {
  const [quantity, currency, account] = value.debit;
  return new Debit({ quantity, currency, transaction, account, note: value.comment });
};

export class Trade {
  /**
   * Construct using the output of the Parser helper.
   * @param {Object} parsed value
   * @param {Transaction} transaction
   */
  constructor(value, transaction) {
    const { connector, reversed, shortcut } = value;
    this.connector = connector;
    const credit = makeCredit(value, transaction);
    const debit = makeDebit(value, transaction);
    this.reversed = reversed;
    this.shortcut = shortcut;
    if (value.connector === '@') {
      // if parser reversed the trade sides because of a leading "-", make sure
      // to adjust quantity appropriately
      if (reversed) {
        debit.quantity = debit.quantity.times(credit.quantity);
      } else {
        credit.quantity = credit.quantity.times(debit.quantity);
      }
    }
    debit.setPair(credit, value.connector, this);
    this.debit = debit;
    this.credit = credit;
  }

  getSymbol() {
    if (!this.isTrade()) {
      throw new Error('Not a trade');
    }
    // if (isDebit(this)) {
    //   return `${this.currency}/${this.pair.currency}`;
    // }
    return this.pair.getTradePairSymbol();
  }

  toObject(props = {}) {
    return {
      shortcut: this.shortcut,
      debit: this.debit.toObject(props),
      credit: this.credit.toObject(props),
    };
  }
}
