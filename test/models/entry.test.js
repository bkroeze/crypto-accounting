import test from 'ava';

import Entry from '../../src/models/entry';
import Transaction from '../../src/models/transaction';

const TX = new Transaction({
  utc: '2018-01-01',
  account: 'test',
});

test('Entry can instantiate via props', t => {
  const note = "test note";
  const e = new Entry({
    transaction: TX,
    credits: [{quantity: 1, currency: 'BTC'}],
    debits: [{quantity: 10, currency: 'ETH'}],
    note
  });
  t.is(e.transaction, TX);
  t.is(e.note, note);
});

test('Entry can instantiate a full set of props', t => {
  const note = "test note 2";
  const props = {
    credits: [{quantity: 1, currency: 'BTC'}],
    debits: [{quantity: 10, currency: 'ETH'}],
    fees: [],
    tags: [],
    note,
  };
  const e = new Entry({...props, transaction: TX});
  t.deepEqual(e.toObject(), props);
});

test('Entry can instatiate via shortcut', t => {
  const e = new Entry({transaction: TX, shortcut: '100 ETH'});
  t.is(e.debits[0].quantity.toFixed(0), '100');
  t.is(e.debits[0].currency, 'ETH');
  t.is(e.credits.length, 0);
});
