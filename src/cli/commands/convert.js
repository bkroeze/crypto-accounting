const R = require('ramda');
const BigNumber = require('bignumber.js');
const path = require('path');
const moment = require('moment');
const fs = require('graceful-fs');
const log = require('js-logger').get('cli.commands.convert');

const Transaction = require('../../models/transaction');
const { parseWalletCSV, rowToYaml, mergeTransactionLists } = require('../../loaders/csv_converter');
const ledgerLoader = require('../../loaders/ledger_loader');
const { flexibleLoadByExtSync } = require('../../loaders/yaml_loader');

const ascendingDate = R.ascend(R.prop('utc'));
const descendingDate = R.descend(R.prop('utc'));

function readCSV(filename, currency, debit, credit) {
  return parseWalletCSV(
    fs.readFileSync(filename).toString(),
    currency,
    debit,
    credit);
}

function readJSON(filename, base, cb) {
  let raw = fs.readFileSync(filename).toString();
  //const re = /\"amount\" : (.*),/g
  // quote the amount, so that we don't lose precision
  //raw = raw.replace(re, '"Amount" : "$1"');
  const work = JSON.parse(raw);
  let results = work.map(row => {
    return {
      date: moment(row.time * 1000),
      address: row.address,
      label: base,
      amount: row.amount,
    };
  });
  return R.reject((row) => row.amount === 0, results);
}

function readLedger(filename) {
  return ledgerLoader.loadTransactionsFromFilenameSync(filename);
}

function printResults(results, base, credit, debit, descending, byDay, startDate) {
  let work = results;
  //console.log(work);
  if (startDate) {
    const searchDate = moment(startDate);
    console.log('filtering for startDate', results.length)
    work = results.filter(x => searchDate.isSameOrBefore(x.utc));
    console.log('trimmed to', results.length);
  }
  const sorter = descending ? descendingDate : ascendingDate;
  let sorted = R.sort(sorter, work);
  if (byDay) {
    const work = [];
    let current;
    sorted.forEach(row => {
      if (!current) {
        current = R.clone(row);
        current.date = current.date.startOf('day');
        current.amount = BigNumber(current.amount);
      } else if (current.date.isSame(row.date, 'day') && row.address === current.address) {
        current.amount = current.amount.plus(BigNumber(row.amount));
      } else {
        current.amount = current.amount.toFixed(8);
        work.push(current);
        current = R.clone(row);
        current.date = current.date.startOf('day');
        current.amount = BigNumber(current.amount);
      }
    });
    work.push(current);
    sorted = work;
  }
  sorted.forEach(row => {
    let line;
    try {
      line = row.toYaml(byDay);
    } catch (e) {
      if (e.name === 'TypeError') {
        line = rowToYaml(row, byDay);
      } else {
        throw e;
      }
    }
    console.log(line);
  });
  return true;
}

function handler(args) {
  const {merge, filename, currency, credit, descending} = args;
  if (!fs.existsSync(filename)) {
    console.log(`File not found: ${filename}`);
    process.exit(1);
  }

  if (merge && !fs.existsSync(merge)) {
    console.log(`Merge file not found: ${merge}`);
    process.exit(1);
  }

  const debit = args.debit.replace('{CURRENCY}', currency);

  let processed;
  if (R.endsWith('.csv', filename)) {
    if (!currency) {
      console.log('Please specify a --currency');
      process.exit(1);
    }
    processed = readCSV(filename, currency, debit, credit);
  } else if (R.endsWith('.json', filename)) {
    if (!currency) {
      console.log('Please specify a --currency');
      process.exit(1);
    }
    processed = readJSON(filename, currency);
  } else if (R.endsWith('.dat', filename)) {
    processed = readLedger(filename);
  }

  let work;
  if (!merge) {
    work = processed;
  } else {
    const orig = readLedger(merge);
    work = mergeTransactionLists(orig, processed);
  }
  printResults(work, currency, credit, debit, descending, args.byDay, args.start);
}

function builder(yargs) {
  return yargs
    .option('credit', {default: 'Income:Crypto:MN'})
    .option('debit', {default: 'Assets:Crypto:Wallets:{CURRENCY}'})
    .option('descending', {type: 'boolean', desc: 'Sort in descending date order', default: false})
    .option('byDay', {type: 'boolean', desc: 'Bucket similar transactions by day', default: false})
    .option('start', {type: 'string', desc: 'Starting date', default: false})
    .option('currency', {type: 'string', desc: 'Which symbol for this conversion. EX: BTC'})
    .option('merge', {type: 'string', desc: 'Merge with existing YAML file'})
    .positional('filename', {type: 'string', desc: 'CSV file to read'});
}

module.exports = {
  command: {
    command: 'convert <filename>',
    desc: 'Convert CSV, Ledger or JSON to Yaml-Transaction format',
    builder,
    handler,
  }
};
