import * as R from 'ramda';
import Moment from 'moment';

import {Posting, shortcutToPostings} from './posting';
import {stripFalsyExcept, toObject} from './modelUtils';

// stub out credits/debits/fees
const makeFees = (fees) => fees;

const DEFAULT_PROPS = {
  id: null,
  transaction: null,
  note: '',
  credits: [],
  debits: [],
  fees: [],
  tags: [],
  shortcut: '',
};

const KEYS = R.keysIn(DEFAULT_PROPS);

const getProps = R.pick(KEYS);
const isString = R.is(String);
const shouldIgnore = R.contains(R.__, ['fees','credits','debits']);

export default class Entry {
  /**
   * Construct using a `props` object that must include the parent transaction, and may also
   * include "id", "credits", "debits", "note", "fees" and/or "tags"
   * @param {object} props
   */
  constructor(props={}) {
    const work = isString(props) ? {shortcut: props} : props;

    const merged = R.merge(DEFAULT_PROPS, getProps(work));
    const {fees, credits, debits} = merged;

    if (merged.shortcut && (merged.credits.length || merged.debits.length)) {
      console.error(`Invalid Entry, can't specify a shortcut and credits/debits: ${JSON.stringify(props)}`);
      throw new Error('Invalid Entry, conflicting shortcut');
    }

    KEYS.forEach(key => {
      if (!shouldIgnore(key)) {
        this[key] = merged[key];
      }
    });
    this.fees = makeFees(fees);
    if (merged.shortcut) {
      const postings = shortcutToPostings(merged.shortcut);
      this.credits = postings.credits;
      this.debits = postings.debits;
    } else {
      this.credits = credits.map(p => {
        const posting = new Posting(p);
        posting.type = 'credit';
        return posting;
      });
      this.debits = debits.map(p => {
        const posting = new Posting(p);
        posting.type = 'debit';
        return posting;
      });
    }

    if (!this.transaction) {
      console.error(`Invalid Entry, must have a 'transaction', got: ${JSON.stringify(props)}`);
      throw new Error('Invalid Entry, must have a parent transaction');
    }
  }

  toObject() {
    return stripFalsyExcept({
      id: this.id,
      note: this.note,
      tags: this.tags,
      credits: this.credits.map(toObject),
      debits: this.debits.map(toObject),
      fees: this.fees.map(toObject),
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
