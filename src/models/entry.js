import * as R from 'ramda';
import Moment from 'moment';

const DEFAULT_PROPS = {
  account: null,
  amount: 0,
  currency: null,
  utc: null,
  note: '',
  tags: [],
  transaction: null,
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);

export default class Entry {
  /**
   * Construct using a `props` object that must include "utc", and may also
   * include "notes", "tags", and a list of transactions
   * @param {object} props
   */
  constructor(props={}) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    let transactions = [];

    KEYS.forEach(key => {
      this[key] = merged[key];
    });

    if (!this.transaction) {
      log.error(`Invalid Entry, must have a transaction, got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Entry, must have a transaction');
    }
  }

  toObject() {
    return {
      id: this.id,
      note: this.note,
      tags: this.tags,
      transactions: this.transactions.map(t => t.toObject())
    }
  }

  toString() {
    return `Currency: ${this.id}`;
  }
}
