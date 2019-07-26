const log = require('js-logger').get('cli.commands.prices');
const fs = require('graceful-fs');
const Papa = require('papaparse');
const moment = require('moment');
const path = require('path');
const PriceHistory = require('../../models/pricehistory');
const PairPrice = require('../../models/pairprice');

const randomSeed = Math.floor(Math.random() * 10000);

const FORMATS = {
  coinmarketcap: {
    header: true,
    date: 'Date',
    dateformat: 'MMM DD YYYY',
    price: 'Close**',
  },
  coinmetrics: {
    header: true,
    date: 'date',
    dateformat: 'YYYY-MM-DD',
    price: 'price(USD)',
  },
  barchart: {
    header: true,
    date: 'Time',
    dateformat: 'MM/DD/YY',
    price: 'Open',
  },
  coingecko: {
    header: true,
    date: 'snapped_at',
    dateformat: 'YYYY-MM-DD hh:mm:ssZ',
    price: 'price',
  },
  manual: {
    header: true,
    date: 'date',
    price: 'price',
    dateformat: 'MM/DD/YYYY hh:mm',
  }
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
            const record = {
              id: `${prefix}-${ct}`,
              base: base,
              quote: quote,
              rate: row[fields.price],
              utc:  moment.utc(row[fields.date], fields.dateformat),
            };
            if (!record.rate) {
              console.log(`${record.utc} skip - no rate`)
              ct--;
            } else {
              console.log('REC', JSON.stringify(record));
              const pair = new PairPrice(record);
              // console.log({pair});
              //console.log(`#${ct}: ${record.utc.toISOString()} ${record.base}/${record.quote}`)
              priceHistory.addPrice(pair)
                .catch(e => {
                  console.error(e);
                  process.exit(1);
                });
            }
          });
        }
      };

      Papa.parse(stream, {
        header: fields.header,
        step,
        complete: () => {
          console.log(`Complete, processed ${ct} prices`);
          console.log(`Saved to DB`);
          setTimeout(() => process.exit(0), 2000);
        }
      });
    });
}


function builder(yargs) {
  return yargs
    .option('format', {
      choices: Object.keys(FORMATS),
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
