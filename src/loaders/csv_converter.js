/* eslint no-unused-vars: off */
import parse from 'csv-parse/lib/sync';
import Moment from 'moment';
import * as R from 'ramda';
import { safeDump } from 'js-yaml';

import { CLEARED } from '../models/constants';

import * as utils from '../utils/models';
import { getFS } from './common';

const onlyConfirmed = R.propEq('Confirmed', 'true');
const findAmount = R.find(R.startsWith('Amount'));

export function parseWalletCSV(data, currency, debit, credit) {
  const parsed = parse(data, { columns: true });
  let amountField;
  const toObject = (row) => {
    if (!amountField) {
      amountField = findAmount(R.keysIn(row));
    }
    return utils.stripFalsyExcept({
      id: row.ID,
      account: debit,
      utc: row.Date,
      status: CLEARED,
      party: row.Label,
      note: row.Type,
      address: row.Address,
      entries: [`${row[amountField]} ${credit}`],
    });
  };

  return parsed
    .filter(onlyConfirmed)
    .map(toObject);
}

const keys = ['id', 'account', 'utc', 'status', 'party', 'note', 'address'];

function toYaml(data) {
  const work = [];
  keys.forEach((key) => {
    if (R.has(key, data)) {
      const prefix = work.length === 0 ? '-' : ' ';
      work.push(`${prefix} ${key}: ${data[key]}`);
    }
  });
  if (data.entries && data.entries.length > 0) {
    work.push('  entries:');
    data.entries.forEach((entry) => {
      work.push(`    - ${entry}`);
    });
  } else {
    console.log('no entries', data);
  }
  work.push('');
  return work.join('\n');
}

export function transactionsToYaml(data) {
  return data.map(toYaml).join('\n');
}

export function walletCsvToYamlSync(filename, currency, debit, credit) {
  const data = parseWalletCSV(getFS().readFileSync(filename), currency, debit, credit);
  return transactionsToYaml(data);
}

function byDate(a, b) {
  const dateA = Moment(a.date);
  const dateB = Moment(b.date);
  if (dateA.isBefore(dateB)) {
    return -1;
  }
  if (dateB.isBefore(dateA)) {
    return 1;
  }
  return 0;
}

export function mergeTransactionLists(a, b) {
  const ids = {};
  a.forEach((tx) => {
    if (tx.id) {
      ids[tx.id] = true;
    }
  });
  const work = R.clone(a);
  b.forEach((tx) => {
    if (!ids[tx.id]) {
      work.push(tx);
    }
  });
  work.sort(byDate);
  return work;
}
