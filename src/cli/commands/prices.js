const log = require('js-logger').get('cli.commands.prices');
const fs = require('graceful-fs');
const path = require('path');
const moment = require('moment');
const PriceHistory = require('../../models/pricehistory');
const PairPrice = require('../../models/pairprice');
const { loadJournalFromFilenameSync } = require('../../loaders/loader');

function getInfoByPair(prices, pair) {
  if (!pair) {
    return "Need --pair to inspect";
  }
  const coll = prices.priceCollection
        .chain()
        .find({pair})
        .simplesort('utc')
        .data();

  const start = moment(coll[0].utc).toLocaleString();
  const end = moment(coll[coll.length-1].utc).toLocaleString();
  const gaps = PriceHistory.findGaps(coll);

  return (`${coll.length} ${pair} prices
Starting at: ${start}
Ending at: ${end}
Gaps: ${gaps.length > 0 ? gaps.join('\n') : 'None'}
`);
}

function handler({db, action, pair, journal}) {
  if (!fs.existsSync(db)) {
    console.log(`File not found: ${db}`);
    process.exit(1);
  }
  PriceHistory
    .load([], db)
    .then((prices) => {
      switch(action) {
      case 'length': {
        console.log(`${prices.priceCollection.find().length} prices`);
        break;
      }
      case 'info': {
        console.log(getInfoByPair(prices, pair));
        break;
      }
      case 'missing': {
        if (!journal) {
          console.log('I need a journal file to search for missing prices');
          process.exit(1);
        }
        const loaded = loadJournalFromFilenameSync(journal);
        const missing = PriceHistory.findMissingDatesInJournal(loaded);
        console.log(`Missing price history for transactions in: ${loaded.name}`);
        if (!missing.length) {
          console.log('None');
        } else {
          missing.forEach(({pair, utc}) => console.log(`${utc.format('YYYY-MM-DD')} ${pair}`));
        }
      }

      }
      process.exit(0);
    })
    .catch(e => {
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
      choices: ['length', 'info', 'missing'],
      default: 'info'
    })
    .option('journal', {
      desc: 'Filename of journal file, required if doing a "missing" search',
    })
    .option('pair');
}

module.exports = {
  command: {
    command: 'prices',
    desc: 'query prices',
    builder,
    handler,
  }
};
