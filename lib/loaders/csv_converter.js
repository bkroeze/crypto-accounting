/* eslint no-unused-vars: off */
const R = require('ramda');
const parse = require('csv-parse/lib/sync');
const Moment = require('moment');
const { safeDump } = require('js-yaml');

const { CLEARED } = require('../models/constants');

const utils = require('../utils/models');
const { getFS } = require('./common');

const onlyConfirmed = R.propEq('Confirmed', 'true');
const findAmount = R.find(R.startsWith('Amount'));

function parseWalletCSV(data, currency, debit, credit) {
  const parsed = parse(data, { columns: true });
  let amountField;
  const toObject = row => {
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
      entries: [`${row[amountField]} ${credit}`]
    });
  };

  return parsed.filter(onlyConfirmed).map(toObject);
}

const keys = ['id', 'account', 'utc', 'status', 'party', 'note', 'address'];

function toYaml(data) {
  const work = [];
  keys.forEach(key => {
    if (R.has(key, data)) {
      const prefix = work.length === 0 ? '-' : ' ';
      work.push(`${prefix} ${key}: ${data[key]}`);
    }
  });
  if (data.entries && data.entries.length > 0) {
    work.push('  entries:');
    data.entries.forEach(entry => {
      work.push(`    - ${entry}`);
    });
  } else {
    console.log('no entries', data);
  }
  work.push('');
  return work.join('\n');
}

function transactionsToYaml(data) {
  return data.map(toYaml).join('\n');
}

function walletCsvToYamlSync(filename, currency, debit, credit) {
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

function mergeTransactionLists(a, b) {
  const ids = {};
  a.forEach(tx => {
    if (tx.id) {
      ids[tx.id] = true;
    }
  });
  const work = R.clone(a);
  b.forEach(tx => {
    if (!ids[tx.id]) {
      work.push(tx);
    }
  });
  work.sort(byDate);
  return work;
}

module.exports = {
  parseWalletCSV,
  transactionsToYaml,
  walletCsvToYamlSync,
  byDate,
  mergeTransactionLists
};
//# sourceMappingURL=csv_converter.js.map
