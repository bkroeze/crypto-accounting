import test from 'ava';
import * as R from 'ramda';
import { Transaction } from '../../src/models/transaction';
import { Lot } from '../../src/models/lot';
import { PriceHistory } from '../../src/models/pricehistory';
import { addBigNumbers } from '../../src/utils/numbers';
import { journalFinder } from '../utils';

const getJournal = journalFinder(__dirname);

test('Can make a lot with a debit', (t) => {
  const transaction = new Transaction({
    account: 'test',
    utc: '2018-07-04',
    trades: ['10 ETH @ 400 USD exchange']
  });
  t.is(transaction.entries.length, 2);
  const debits = transaction.getDebits();
  t.is(debits.length, 1);
  const lot = new Lot(debits[0]);
  t.is(lot.currency, 'ETH');
  t.is(lot.getTotal().toFixed(0), '10');
});

test('Calculates remaining credit left to apply to lots', (t) => {
  const transaction = new Transaction({
    account: 'test',
    utc: '2018-07-04',
    trades: ['10 ETH @ 400 USD exchange']
  });
  const debits = transaction.getDebits();
  t.is(debits.length, 1);
  const lot = new Lot(debits[0]);
  t.is(lot.currency, 'ETH');
  t.is(lot.getTotal().toFixed(0), '10');

  t.is(lot.getRemaining().toFixed(0), '10');
});

test('Calculates gains', async (t) => {
  const transaction = new Transaction({
    account: 'test',
    utc: '2018-07-04',
    trades: [
      '10 ETH @ 400 USD exchange',
    ]
  });
  const debits = transaction.getDebits();
  const lot = new Lot(debits[0]);
  t.is(lot.debits.length, 1);

  const sale = new Transaction({
    account: 'test',
    utc: '2018-07-04',
    trades: [
      '-5 ETH @ 600 USD exchange',
    ]
  });
  //console.log(sale.toObject());
  const credits = sale.getCredits();
  t.is(credits[0].quantity.toFixed(0), '5');
  t.is(credits[0].type, 'credit');
  const applied = lot.addCredit(credits[0], credits[0].quantity);
  t.is(applied.toFixed(0), '5');
  t.is(lot.credits.length, 1);
  t.is(lot.getRemaining().toFixed(0), '5');

  const prices = [
    '2018-07-04 ETH/USD 400',
    '2018-07-14 ETH/USD 600',
  ];
  const history = await PriceHistory.load(prices);
  const gains = lot.getCapitalGains(history, 'income:capitalgains', 'USD');
  // console.log(gains.map(g => g.toObject()));
  t.is(gains.length, 1);
  t.is(gains[0].quantity.toFixed(2), '1000.00');
  t.is(gains[0].currency, 'USD');

});

test('Calculates gains details', async (t) => {
  const transaction = new Transaction({
    account: 'test',
    utc: '2018-07-04',
    trades: [
      '10 ETH @ 400 USD exchange',
    ]
  });

  const sale = new Transaction({
    account: 'test',
    utc: '2018-07-04',
    trades: [
      '-5 ETH @ 600 USD exchange',
    ]
  });

  const debits = transaction.getDebits();
  const lot = new Lot(debits[0]);
  const credits = sale.getCredits();
  t.is(credits[0].currency, 'ETH');
  lot.addCredit(credits[0], credits[0].quantity);
  const prices = [
    '2018-07-04 ETH/USD 400',
    '2018-07-14 ETH/USD 600',
  ];
  const history = await PriceHistory.load(prices);
  const gains = lot.getCapitalGainsDetails(history, 'USD');
  // console.log(JSON.stringify(gains, null, 2));
  t.is(gains.length, 1);
  const g = gains[0];
  t.is(g.creditCurrency, 'ETH');
  t.is(g.currency, 'USD');
  t.is(g.proceeds.toFixed(2), '3000.00');
  t.is(g.cost.toFixed(2), '2000.00');
  t.is(g.dateAcquired.format('MM-DD-YY'), '07-04-18');
  t.is(g.profit.toFixed(2), '1000.00');
});

test('getPurchasePrice direct-to-fiat', async t => {
  const journal = getJournal('journal_gains1.yaml');
  const lots = journal.getLots();
  t.is(lots.length, 2);
  let lot = lots[0];
  journal.pricehistory.waitForLoad()
    .then(history => {
      let price = lot.getPurchasePriceEach(history, 'USD');
      t.is(price.toFixed(2), '500.00');

      lot = lots[1];
      price = lot.getPurchasePriceEach(history, 'USD');
      t.is(price.toFixed(2), '550.00');
    });
});

test('getPurchasePrice from translation', async t => {
  const journal = getJournal('journal_gains2.yaml');
  const lots = journal.getLots();
  //lots.forEach(l => {console.log(l.toObject())});
  t.is(lots.length, 5);
  let lot = lots[2];
  t.is(lot.debits[0].debit.pair.currency, 'BTC');
  journal.pricehistory.waitForLoad()
    .then(history => {
      let price = lot.getPurchasePriceEach(history, 'USD');
      t.is(price.toFixed(2), '465.00');
    });
});

test('getSalePrice direct-to-fiat', async t => {
  const journal = getJournal('journal_gains1.yaml');
  const lots = journal.getLots();
  t.is(lots.length, 2);
  let lot = lots[0];
  let {credit} = lot.credits[0];
  journal.pricehistory.waitForLoad()
    .then(history => {
      let price = Lot.getSalePriceEach(credit, history, 'USD');
      t.is(price.toFixed(2), '400.00');

      credit = lot.credits[1].credit;
      price = Lot.getSalePriceEach(credit, history, 'USD');
      t.is(price.toFixed(2), '600.00');
    });
});

test('getSalePrice from translation', async t => {
  const journal = getJournal('journal_gains2.yaml');
  const lots = journal.getLots();
  t.is(lots.length, 5);
  let lot = lots[1];
  journal.pricehistory.waitForLoad()
    .then(history => {
      let price = Lot.getSalePriceEach(lot.credits[0].credit, history, 'USD');
      t.is(price.toFixed(2), '400.00');
      price = Lot.getSalePriceEach(lot.credits[1].credit, history, 'USD');
      t.is(price.toFixed(2), '600.00');

      lot = lots[2];
      price = Lot.getSalePriceEach(lot.credits[0].credit, history, 'USD');
      t.is(price.toFixed(2), '600.00');

      price = Lot.getSalePriceEach(lot.credits[1].credit, history, 'USD');
      t.is(price.toFixed(2), '750.00');
    });
});

test('calculate gains with historical prices different than realized', async t => {
  const journal = getJournal('journal_gains1.yaml');
  t.is(journal.transactions.length, 5);
  const lots = journal.getLots();
  t.is(lots.length, 2);
  //console.log(lots[0].toObject());
  t.is(lots[0].credits.length, 2);
  journal.pricehistory.waitForLoad()
    .then(history => {
      const gains1 = lots[0].getCapitalGains(history, 'income:capitalgains', 'USD');
      //gains1.forEach(g => { console.log(g.toObject())});
      t.is(gains1.length, 2);
      t.is(gains1[0].quantity.toFixed(2), '-100.00');
      t.is(gains1[1].quantity.toFixed(2), '100.00');

      const gains2 = lots[1].getCapitalGains(history, 'income:capitalgains', 'USD');
      t.is(gains2.length, 2);
      t.is(gains2[0].quantity.toFixed(2), '50.00');
      t.is(gains2[1].quantity.toFixed(2), '900.00');
    });
});

test('calculates gains with non-fiat pair', async t => {
  const journal = getJournal('journal_gains2.yaml');
  const lots = journal.getLots();
  t.is(lots.length, 5);
  journal.pricehistory.waitForLoad()
    .then(history => {
      let gains = lots[1].getCapitalGains(history, 'income:capitalgains', 'USD');
      t.deepEqual(gains.map(g => g.quantity.toFixed(0)), ['-100', '100']);

      gains = lots[2].getCapitalGains(history, 'income:capitalgains', 'USD');
      //gains.forEach(g => console.log(g.toObject()));
      t.deepEqual(gains.map(g => g.quantity.toFixed(0)), ['135', '570']);

      const allGains = R.flatten(lots.map(l => l.getCapitalGains(history, 'income:capitalgains', 'USD')));
      //console.log(JSON.stringify(lots[0].toObject(), null, 2));
      //allGains.forEach(g => console.log(g.toObject()));
      const totals = R.map(R.prop('quantity'), allGains);
      //console.log(`totals: ${totals.map(t => t.toFixed(2))}`);
      const total = addBigNumbers(totals);
      t.is(total.toFixed(0), '195');
    });
});

test('Calculates unrealized gains', async t => {
  const journal = getJournal('journal_gains2.yaml');
  const lots = journal.getLots();
  const lot = lots[0];
  journal.pricehistory.waitForLoad()
    .then(history => {
      const unrealized = lot.getUnrealizedGains('2018-03-01', history, 'income:unrealized', 'USD');
      t.is(unrealized.quantity.toFixed(2), '-13605.00');
    });
});


test('Calculates gains, including fees', async t => {
  const journal = getJournal('journal_gains_fees.yaml');
  const lots = journal.getLots();
  t.is(lots.length, 1);
  const lot = lots[0];
  journal.pricehistory.waitForLoad()
    .then(history => {
      const priceEa = lot.getPurchasePriceEach(history, 'USD');
      t.is(priceEa.toFixed(2), '102.50');
      const unrealized = lot.getUnrealizedGains('2018-03-01', history, 'income:unrealized', 'USD');
      t.is(unrealized.quantity.toFixed(2), '495.00');
      const gains = lot.getCapitalGains(history, 'income:capitalgains', 'USD');
      t.is(gains.length, 6); // includes 3 gains from the fees themselves
      const totalGains = addBigNumbers(gains.map(R.prop('quantity')));
      t.is(totalGains.toFixed(2), '301.85');
    });
});

test('finds entries in lots', t => {
  const journal = getJournal('journal_gains1.yaml');
  const lots = journal.getLots();
  const lot0 = lots[0].toObject();
  const lot1 = lots[1].toObject();
  const entry0 = lot0.debits[0];
  const entry1 = R.last(lot1.debits);
  t.truthy(entry0);
  t.is(lots[0].contains(entry0), true);
  t.is(lots[0].contains(entry1), false);
  t.is(lots[1].contains(entry0), false);
  t.truthy(entry1);
  t.is(lots[1].contains(entry1), true);
});
