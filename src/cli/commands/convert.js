import * as R from 'ramda';
import BigNumber from 'bignumber.js';
import moment from 'moment';
import fs from 'graceful-fs';

import { safeLoad, safeDump } from 'js-yaml';

import { stripFalsy } from '../../utils/models';
import { parseWalletCSV, mergeTransactionLists } from '../../loaders/csv_converter';
import { loadObjectsFromString } from '../../loaders/ledger_loader';

const ascendingDate = R.ascend(R.prop('utc'));
const descendingDate = R.descend(R.prop('utc'));

const randomSeed = Math.floor(Math.random() * 10000);

function readCSV(raw, currency, debit, credit) {
  return parseWalletCSV(
    raw,
    currency,
    debit,
    credit
  );
}

function readJSON(raw, base) {
  const work = JSON.parse(raw);
  const results = work.map(row => ({
    date: moment(row.time * 1000),
    address: row.address,
    label: base,
    amount: row.amount,
  }));
  return R.reject(R.propEqual('amount', 0), results);
}

let wrapperIndex = 0;
function nextIndex() {
  wrapperIndex++;
  return wrapperIndex;
}

class LedgerWrapper {
  constructor(props) {
    this.props = {
      id: `import-${moment().format('YYMMDD')}-${randomSeed}-${nextIndex()}`,
      ...props,
    };
    this.utc = moment.utc(props.utc);
    this.props.utc = this.utc.toISOString();
  }

  toYaml() {
    return safeDump([stripFalsy(this.props)]).replace(/'/g, '');
  }
}

const ledgerWrapFactory = props => new LedgerWrapper(props);

function readLedger(raw) {
  return loadObjectsFromString(raw)
    .map(ledgerWrapFactory);
}


function printResults(results, base, credit, debit, descending, byDay, startDate) {
  let work = results;
  // console.log(work);
  if (startDate) {
    const searchDate = moment.utc(startDate);
    console.log('filtering for startDate', results.length);
    work = results.filter(x => searchDate.isSameOrBefore(x.utc));
    console.log('trimmed to', results.length);
  }
  const sorter = descending ? descendingDate : ascendingDate;
  let sorted = R.sort(sorter, work);
  if (byDay) {
    work = [];
    let current;
    sorted.forEach((row) => {
      if (!current) {
        current = R.clone(row);
        current.date = current.utc.startOf('day');
        current.amount = BigNumber(current.amount);
      } else if (current.utc.isSame(row.utc, 'day') && row.address === current.address) {
        current.amount = current.amount.plus(BigNumber(row.amount));
      } else {
        current.amount = current.amount.toFixed(8);
        work.push(current);
        current = R.clone(row);
        current.utc = current.utc.startOf('day');
        current.amount = BigNumber(current.amount);
      }
    });
    work.push(current);
    sorted = work;
  }
  sorted.forEach((row) => {
    console.log(row.toYaml(byDay));
  });
  return true;
}

function handler(args) {
  const { merge, filename, currency, credit, descending, conversion } = args;
  if (!fs.existsSync(filename)) {
    console.log(`File not found: ${filename}`);
    process.exit(1);
  }

  if (merge && !fs.existsSync(merge)) {
    console.log(`Merge file not found: ${merge}`);
    process.exit(1);
  }

  if (conversion && !fs.existsSync(conversion)) {
    console.log(`Conversion file not found: ${conversion}`);
    process.exit(1);
  }

  let raw = fs.readFileSync(filename, 'utf-8');

  if (conversion) {
    const conversions = [];
    const conversionMap = safeLoad(fs.readFileSync(conversion));
    conversionMap.forEach((patternSet) => {
      patternSet.from.forEach((toreplace) => {
        conversions.push(x => x.replace(new RegExp(toreplace, 'g'), patternSet.account));
      });
    });

    conversions.forEach((c) => {
      raw = c(raw);
    });
  }

  const debit = args.debit.replace('{CURRENCY}', currency);

  let processed;
  if (R.endsWith('.csv', filename)) {
    if (!currency) {
      console.log('Please specify a --currency');
      process.exit(1);
    }
    processed = readCSV(raw, currency, debit, credit);
  } else if (R.endsWith('.json', filename)) {
    if (!currency) {
      console.log('Please specify a --currency');
      process.exit(1);
    }
    processed = readJSON(raw, currency);
  } else if (R.endsWith('.dat', filename)) {
    processed = readLedger(raw);
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
    .option('credit', { default: 'Income:Crypto:MN' })
    .option('debit', { default: 'Assets:Crypto:Wallets:{CURRENCY}' })
    .option('descending', { type: 'boolean', desc: 'Sort in descending date order', default: false })
    .option('byDay', { type: 'boolean', desc: 'Bucket similar transactions by day', default: false })
    .option('start', { type: 'string', desc: 'Starting date', default: false })
    .option('currency', { type: 'string', desc: 'Which symbol for this conversion. EX: BTC' })
    .option('merge', { type: 'string', desc: 'Merge with existing YAML file' })
    .option('conversion', { type: 'string', desc: 'Yaml file for account conversions' })
    .positional('filename', { type: 'string', desc: 'File to read' });
}

export default {
  command: {
    command: 'convert <filename>',
    desc: 'Convert CSV, Ledger or JSON to Yaml-Transaction format',
    builder,
    handler,
  },
};
