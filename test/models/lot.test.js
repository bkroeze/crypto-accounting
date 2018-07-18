import test from 'ava';
import Transaction from '../../src/models/transaction';
import Lot from '../../src/models/lot';
import PriceHistory from '../../src/models/pricehistory';

test('Can make a lot with a debit', (t) => {
  const transaction = new Transaction({
    account: 'test',
    utc: '2018-07-04',
    entries: ['10 ETH @ 400 USD exchange']
  });
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
    entries: ['10 ETH @ 400 USD exchange']
  });
  const debits = transaction.getDebits();
  t.is(debits.length, 1);
  const lot = new Lot(debits[0]);
  t.is(lot.currency, 'ETH');
  t.is(lot.getTotal().toFixed(0), '10');

  t.is(lot.getRemaining().toFixed(0), '10');
});

test('Calculates gains', (t) => {
  const transaction = new Transaction({
    account: 'test',
    utc: '2018-07-04',
    entries: [
      '10 ETH @ 400 USD exchange',
    ]
  });
  const debits = transaction.getDebits();
  const lot = new Lot(debits[0]);
  t.is(lot.debits.length, 1);

  const sale = new Transaction({
    account: 'test',
    utc: '2018-07-04',
    entries: [
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
  const history = new PriceHistory(prices);

  const gains = lot.getCapitalGains(history, 'income:capitalgains', 'USD');
  //console.log(gains.map(g => g.toObject()));
  t.is(gains.length, 1);
  t.is(gains[0].quantity.toFixed(2), '1000.00');
  t.is(gains[0].currency, 'USD');
});

test.todo('calculate gains with historical prices different than realized');
