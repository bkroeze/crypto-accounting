import fs from 'graceful-fs';
import moment from 'moment';
import { PriceHistory } from '../../models/pricehistory';
import { loadJournalFromFilenameSync } from '../../loaders/loader';

function getInfoByPair(prices, pair) {
  if (!pair) {
    return 'Need --pair to inspect';
  }
  const coll = prices.priceCollection
    .chain()
    .find({ pair })
    .simplesort('utc')
    .data();

  if (coll.length === 0) {
    return `No data for ${pair}`;
  }
  const start = moment.utc(coll[0].utc).toLocaleString();
  const end = moment.utc(coll[coll.length - 1].utc).toLocaleString();
  // const gaps = PriceHistory.findGaps(coll);
  const gaps = [];

  return (`${coll.length} ${pair} prices
Starting at: ${start}
Ending at: ${end}
Gaps: ${gaps.length > 0 ? gaps.join('\n') : 'None'}
`);
}

function logProblems(problems) {
  problems.missing.forEach(({ pair, utc }) => console.log(`${utc.toISOString().substring(0, 10)} ${pair}`));
}

function handler({ db, action, pair, journal, date }) {
  if (!fs.existsSync(db)) {
    console.log(`File not found: ${db}`);
    process.exit(1);
  }
  PriceHistory
    .load([], db)
    .then((prices) => {
      console.log(db);
      switch (action) {
        case 'length': {
          console.log(`${prices.priceCollection.find().length} prices`);
          break;
        }
        case 'info': {
          console.log(getInfoByPair(prices, pair));
          break;
        }
        case 'date': {
          if (!date) {
            console.log('please provide a --date to look up');
          }
          const queryDate = moment.utc(date);
          const [base, quote] = pair.split('/');
          const price = prices.findPrice(queryDate, base, quote);
          console.log('price on date: ', price.toObject());
          break;
        }
        case 'missing': {
          if (!journal) {
            console.log('I need a journal file to search for missing prices');
            process.exit(1);
          }
          const loaded = loadJournalFromFilenameSync(journal);
          const problems = prices.findMissingDatesInJournal(loaded);
          console.log(`Missing price history for transactions in: ${loaded.name}`);
          if (problems.isEmpty) {
            console.log('None');
          } else {
            logProblems(problems);
          }
          break;
        }
        case 'clean': {
          const [base, quote] = pair.split('/');
          console.log(prices.cleanPair(base, quote));
          break;
        }
        case 'delete': {
          const [base, quote] = pair.split('/');
          console.log(prices.deletePair(base, quote));
          break;
        }
        default: {
          console.log(`Unknown action ${action}`);
          break;
        }
      }
      process.exit(0);
    })
    .catch((e) => {
      console.log(e);
      process.exit(1);
    });
}


function builder(yargs) {
  return yargs
    .option('db', {
      desc: 'Loki DB file to update or create',
      default: 'db/prices.db',
    })
    .option('action', {
      choices: ['length', 'info', 'missing', 'date', 'clean', 'delete'],
      default: 'info',
    })
    .option('journal', { desc: 'Filename of journal file, required if doing a "missing" search' })
    .option('date', { desc: 'UTC date (for price lookup)' })
    .option('pair');
}

export default {
  command: {
    command: 'prices',
    desc: 'query prices',
    builder,
    handler,
  },
};
