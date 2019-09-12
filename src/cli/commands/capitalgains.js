import fs from 'graceful-fs';
import Moment from 'moment';
import * as R from 'ramda'
import papa from 'papaparse';
import { loadJournalFromFilenameSync } from '../../loaders/loader';

const addGains = (g1, g2) => ({
  quantity: g1.quantity.plus(g2.quantity),
  creditCurrency: g1.creditCurrency,
  dateAcquired: g1.dateAcquired.isBefore(g2.dateAcquired) ? g1.dateAcquired : g2.dateAcquired,
  dateSold: g1.dateSold.isAfter(g2.dateSold) ? g1.dateSold : g2.dateSold,
  proceeds: g1.proceeds.plus(g2.proceeds),
  cost: g1.cost.plus(g2.cost),
  profit: g1.profit.plus(g2.profit),
});

const toDetail = gain => ({
  quantity: gain.quantity.toFixed(8),
  asset: gain.creditCurrency,
  date_acquired: gain.dateAcquired.format('YYYY-MM-DD'),
  date_sold: gain.dateSold.format('YYYY-MM-DD'),
  proceeds: gain.proceeds.toFixed(2),
  cost: gain.cost.toFixed(2),
  profit: gain.profit.toFixed(2),
});

const makeDetailResults = gains => gains.map(toDetail);

const makeSummaryResults = gains => {
  console.log('summary results');
  const results = {};
  gains.forEach(gain => {
    const curr = gain.creditCurrency;
    const existing = results[curr];
    if (existing) {
      results[curr] = addGains(existing, gain);
    } else {
      results[curr] = gain;
    }
  });
  const keys = Object.keys(results);
  keys.sort();
  return keys.map(k => results[k]);
};

function handler({ journal, start, end, fiat, summarize }) {
  const ledger = loadJournalFromFilenameSync(journal);
  const startMoment = Moment(start);
  const endMoment = Moment(end);
  ledger.pricehistory
    .waitForLoad()
    .then(history => {
      const lots = ledger.getLots();
      return R.flatten(
        lots.map((lot, ix) => {
          // console.log(`lot ${ix}`);
          return lot
            .getCapitalGainsDetails(
              history,
              fiat,
              ['BTC', 'ETH'],
              null,
              startMoment,
              endMoment
            );
        }));
    })
    .then(gains => {
      const results = summarize ?
            makeSummaryResults(gains)
            : gains;

      const details = results.map(toDetail);

      console.log(papa.unparse(details));
      process.exit(0);
    })
    .catch((e) => {
      console.log(e);
      process.exit(1);
    });
}


function builder(yargs) {
  return yargs
    .option('journal', { desc: 'Filename of journal file' })
    .option('start', { desc: 'UTC date start' })
    .option('end', { desc: 'UTC date end' })
    .option('fiat', { desc: 'Fiat currency', default: 'USD' })
    .option('summarize', { desc: 'Total by currency', type: 'boolean', default: false })
    .demandOption(['start','end']);
}

export default {
  command: {
    command: 'capitalgains',
    desc: 'capital gains report',
    builder,
    handler,
  },
};
