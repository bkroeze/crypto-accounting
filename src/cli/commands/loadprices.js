const log = require('js-logger').get('cli.commands.prices');
const fs = require('graceful-fs');
const Papa = require('papaparse');
const moment = require('moment');
const path = require('path');
const PriceHistory = require('../../models/pricehistory');
const PairPrice = require('../../models/pairprice');

const randomSeed = Math.floor(Math.random() * 10000);

const FORMATS = {
  coinmetrics: {
    header: true,
    date: 'date',
    dateformat: 'YYYY-MM-DD',
    price: 'price(USD)',
  },
}

function makePrefix(options) {
  let {prefix} = options;
  return prefix
    .replace(/%R/g, randomSeed)
    .replace(/%F/g, path.parse(options.filename).name)
    .replace(/%D/g, moment().format('YYMMDD'));
}

function handler(args) {
  const {filename, format, base, quote} = args;
  if (!FORMATS[format]) {
    console.log(`Invalid choice of format: ${format}`);
    process.exit(1);
  }

  const fields = {
    base,
    quote,
    ...FORMATS[format],
  };
  let ct = 0;

  if (!fs.existsSync(filename)) {
    console.log(`File not found: ${filename}`);
    process.exit(1);
  }

  const stream = fs.createReadStream(filename, 'utf8');
  const prefix = makePrefix(args);

  PriceHistory
    .load([], args.db)
    .then((priceHistory) => {
      const step = (results, parser) => {
        if (results.data) {
          results.data.forEach((row) => {
            ct++;
            console.log(`Adding #${ct}`);
            const record = {
              id: `${prefix}-${ct}`,
              base: fields.base,
              quote: fields.quote,
              rate: row[fields.price],
              utc:  moment.utc(row[fields.date], fields.dateformat),
            };
            // console.log('REC', JSON.stringify(record));
            const pair = new PairPrice(record);
            // console.log({pair});
            priceHistory.addPrice(pair)
              .catch(e => {
                console.error(e);
                priceHistory.flushChanges();
                process.exit(1);
              });
          });
        }
      };

      Papa.parse(stream, {
        header: fields.header,
        step,
        complete: () => {
          console.log(`Complete, processed ${ct} prices`);
          priceHistory.flushChanges();
          process.exit(0);
        }
      });
    });
}


function builder(yargs) {
  return yargs
    .option('format', {
      choices: ['coinmetrics'],
      default: 'coinmetrics',
    })
    .option('base', {
      desc: 'Base currency (price is for each of this currency)'
    })
    .option('quote', {
      desc: 'Quote currency (how many of these to buy 1 base)',
      default: 'USD'
    })
    .option('prefix', {
      desc: 'ID prefix, defaulting to filename-date-, use %R for a random, %D for date, and %F for the filename',
      default: '%F-%D',
    })
    .option('db', {
      desc: 'Loki DB file to update or create',
      default: 'prices.db',
    })
    .demandOption(['base'])
    .positional('filename', {
      type: 'string', desc: 'File to read'
    });
}

module.exports = {
  command: {
    command: 'loadprices <filename>',
    desc: 'Load prices from a CSV file',
    builder,
    handler,
  }
};
