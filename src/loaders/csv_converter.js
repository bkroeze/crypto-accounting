/* eslint no-unused-vars: off */
const R = require('ramda');
const RA = require('ramda-adjunct');
const parse = require('csv-parse/lib/sync');
const Moment = require('moment');
const { safeDump } = require('js-yaml');

const { CLEARED } = require('../models/constants');

const utils = require('../utils/models');
const { getFS } = require('./common');

const onlyConfirmed = R.propEq('Confirmed', 'true');
const findAmount = R.find(R.startsWith('Amount'));
const getIds = R.map(R.prop('id'));

/**
 * Parse a CSV string into transaction objects.
 * @param {String} data
 * @param {String} currency (ex: BTC)
 * @param {String} debit account
 * @param {String} credit account
 * @return {Array<Object>} List of transaction objects
 */
function parseWalletCSV(data, currency, debit, credit) {
  const parsed = parse(data, { columns: true });
  let amountField;
  const toObject = (row, ix) => {
    if (!amountField) {
      amountField = findAmount(R.keysIn(row));
    }
    return utils.stripFalsyExcept({
      id: row.ID ? row.ID : `${row.date}-${ix}`,
      account: debit,
      utc: Moment(row.Date),
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

/**
 * Convert a transaction object to its yaml representation
 * @param {Object} data
 * @param {Boolean} byDay if bucketed
 * @return {String} YAML representation
 */
function toYaml(data, byDay) {
  const work = [];
  keys.forEach((key) => {
    if (R.has(key, data) && data[key]) {
      const prefix = work.length === 0 ? '-' : ' ';
      let pushed = false;
      let val = data[key];
      if (key === 'account' && RA.isObj(val)) {
        if (val.credit === val.debit) {
          val = val.credit;
        } else {
          work.push(`${prefix} account:`)
          Object.keys(val).forEach((acctKey) => {
            work.push(`    ${acctKey}: ${val[acctKey]}`);
          });
          pushed = true;
        }
      } else if (key === 'utc') {
        val = byDay ? val.toISOString('YYYY-MM-DD').substring(0,10) : val.toISOString();
      }
      if (!pushed) {
        work.push(`${prefix} ${key}: ${val}`);
      }
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

/**
 * Convert a list of yaml transactions to string.
 * @param {Array<String>} data
 * @return {String} Joined output
 */
function transactionsToYaml(data, byDay) {
  return data.map(x => toYaml(x, byDay)).join('\n');
}

/**
 * Load CSV from a file and convert to yaml.
 * @param {String} filename
 * @param {String} currency (ex: BTC)
 * @param {String} debit account
 * @param {String} credit account
 * @return {String} YAML representation
 */
function walletCsvToYamlSync(filename, currency, debit, credit) {
  const data = parseWalletCSV(getFS().readFileSync(filename), currency, debit, credit);
  return transactionsToYaml(data, false);
}

/**
 * Comparison sort function for two transactions by their date
 * @param {String} date a
 * @param {String} date b
 * @return {Integer} 0 if equal, -1 if a is before b, 1 if a is after b
 */
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

/**
 * Merges two transaction lists, repecting IDs.
 * @param {Array<Object>} Transaction list a
 * @param {Array<Object>} Transaction list b
 * @param {Array<Object>} Merged list
 */
function mergeTransactionLists(a, b) {
  const ids = new Set(getIds(a));
  const work = a.map(a => a);
  b.forEach((tx) => {
    if (!ids.has(tx.id)) {
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
  mergeTransactionLists,
  rowToYaml: toYaml,
};
