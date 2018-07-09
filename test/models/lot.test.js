import test from 'ava';
import Transaction from '../../src/models/transaction';
import Lot from '../../src/models/lot';

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
