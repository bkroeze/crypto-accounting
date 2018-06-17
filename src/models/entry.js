import * as R from 'ramda';
import Moment from 'moment';

import {stripFalsyExcept} from './modelUtils';

// stub out credits/debits/fees
const ZERO_CREDIT = {};
const ZERO_DEBIT = {};
const makeFees = (fees) => fees;

const DEFAULT_PROPS = {
  id: null,
  transaction: null,
  credit: ZERO_CREDIT,
  debit: ZERO_DEBIT,
  note: '',
  fees: [],
  tags: [],
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
    const {fees} = merged;

    KEYS.forEach(key => {
      if (key !== 'fees') {
        this[key] = merged[key];
      }
    });
    this.fees = makeFees(fees);

    if (!this.transaction) {
      log.error(`Invalid Entry, must have a 'transaction', got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Entry, must have a parent transaction');
    }
  }

  toObject() {
    return stripFalsyExcept({
      id: this.id,
      note: this.note,
      tags: this.tags,
      credit: this.credit,  // change to this.credit.toObject() after object built
      debit: this.debit,  // change to this.debit.toObject()
      fees: this.fees.map(f => f.toObject)
    });
  }

  toString() {
    return `Entry: ${this.note}`;
  }
}

export function makeEntry(tx) {
  return new Entry(tx);
}
export function makeEntries(entries) {
  return entries.map(makeEntry);
}
