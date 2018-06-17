import * as R from 'ramda';
import Moment from 'moment';

import Entry from './entry';
const DEFAULT_PROPS = {
  from: null,
  to: '',
  amount: '',
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);

export default class Transaction {
  /**
   * Construct using a `props` object that must include "utc", and may also
   * include "notes", "tags", and a list of transactions
   * @param {object} props
   */
  constructor(props={}) {
    const merged = R.merge(DEFAULT_PROPS, getProps(props));
    let transactions = [];

    KEYS.forEach(key => {
      if (key === 'transactions') {
        transactions = merged.transactions;
      } else {
        this[key] = merged[key];
      }
    });

    if (!this.utc) {
      log.error(`Invalid Transaction, must have a 'utc', got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Transaction, must have a utc');
    }
    this.utc = Moment(this.utc);
    if (this.parent) {
      this.path = `${this.parent.path}:${this.path}`;
    }
    if (!this.alias) {
      this.alias == this.path;
    }

    // load the transactions
    this.transactions = transactions.map(tx => {
      return new Transaction(tx);
    });
  }

  toObject() {
    return {
      utc: this.utc.toISOString(),
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
