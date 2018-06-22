import * as R from 'ramda';
import Moment from 'moment';

import Entry, {makeEntries} from './entry';
import {stripFalsyExcept} from './modelUtils';

const makeFees = (fees) => fees;  // stub out fee descriptors

const DEFAULT_PROPS = {
  id: '',
  account: '',
  utc: '',
  note: '',
  fees: [],
  tags: [],
  entries: [],
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
    const {entries, fees} = merged;

    KEYS.forEach(key => {
      if (key !== 'transactions' && key !== 'fees') {
        this[key] = merged[key];
      }
    });

    if (!this.utc) {
      log.error(`Invalid Transaction, must have a 'utc', got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Transaction, must have a utc');
    }
    if (!this.account) {
      log.error(`Invalid Transaction, must have a 'account', got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Transaction, must have a account');
    }

    this.utc = Moment(this.utc);
    this.entries = makeEntries(entries);
    this.fees = makeFees(fees);
  }

  toObject() {
    return stripFalsyExcept({
      id: this.id,
      note: this.note,
      account: this.account,
      utc: this.utc.toISOString(),
      tags: this.tags,
      entries: this.entries.map(t => t.toObject()),
      fees: this.fees,  // change to this.fees.map(f => t.toObject()) when unstub
    }, ['entries']);
  }

  toString() {
    return `Transaction: ${this.account} ${this.utc.toISOString} [${this.entries.length} entries]`;
  }
}

export const makeTransactions = (raw) => raw.map(tx => new Transaction(tx));
