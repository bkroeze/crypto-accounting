import test from 'ava';

import Entry, {shortcutToEntries, flexibleToEntries, objectToEntries, makeEntries} from '../../src/models/entry';
import Transaction from '../../src/models/transaction';

const TX = new Transaction({
  utc: '2018-01-01',
  account: 'test',
});

test('Entry can instantiate via props', t => {
  const note = "test note";
  const e = new Entry({
    transaction: TX,
    quantity: 1,
    currency: 'BTC',
    note
  });
  t.is(e.transaction, TX);
  t.is(e.note, note);
});

test('Entry can instantiate a full set of props', t => {
  const props = {
    quantity: 1,
    currency: 'BTC',
    type: 'debit',
    account: 'revenue:test',
    note: "test note 2",
  };
  const e = new Entry({...props, transaction: TX});
  t.deepEqual(e.toObject(), {
    ...props,
    quantity: '1.00000000'
  });
});

test('Entry can instatiate via shortcut', t => {
  const e = new Entry({transaction: TX, shortcut: '100 ETH'});
  t.is(e.quantity.toFixed(0), '100');
  t.is(e.currency, 'ETH');
  t.is(e.getAccount(), 'test');
});

test('Can instantiate a trade pair of entries from a shortcut', t => {
  const entries = shortcutToEntries('1 BTC @ 10000 USD', TX);
  t.is(entries.length, 2);
  t.is(entries[0].type, 'debit');
  t.is(entries[0].quantity.toFixed(0), '1');
  t.is(entries[0].currency, 'BTC');
  t.is(entries[1].type, 'credit');
  t.is(entries[1].quantity.toFixed(0), '10000');
  t.is(entries[1].currency, 'USD');
});

test('Can load an object entry with shortcuts', t => {
  const entries = objectToEntries({
    debits: ['100 ETH', '.01 ETH'],
    credits: [{
      quantity: 10000,
      currency: 'USD',
    }],
  }, TX);
  t.is(entries.length, 3);
  t.is(entries[0].currency, 'ETH');
  t.is(entries[0].quantity.toFixed(0), '100');
  t.is(entries[0].type, 'debit');
  t.is(entries[1].quantity.toFixed(2), '0.01');
  t.is(entries[1].type, 'debit');
  t.is(entries[2].quantity.toFixed(0), '10000');
  t.is(entries[2].currency, 'USD');
  t.is(entries[2].type, 'credit');
});

test('Can load objects and strings interchangeably', t => {
  const e1 = flexibleToEntries({
    debits: ['100 ETH'],
    credits: [{
      quantity: 10000,
      currency: 'USD',
    }],
  }, TX);
  const e2 = flexibleToEntries('100 ETH @ 100 USD', TX);
  const e3 = flexibleToEntries('100 ETH = 10000 USD', TX);
  t.is(e1.length, 2);
  t.is(e2.length, 2);
  t.is(e2.length, 2);
  t.is(e1[0].equals(e2[0]), true);
  t.is(e1[1].equals(e2[1]), true);
  t.is(e1[0].equals(e3[0]), true);
  t.is(e1[1].equals(e3[1]), true);
});

test('Can load a list of mixed types', t => {
  const entries = makeEntries([
    {
      debits: ['100 ETH'],
      credits: [{
        quantity: 10000,
        currency: 'USD',
      }],
    },
    '100 ETH @ 100 USD',
    '100 ETH = 10000 USD'
  ], TX);
  //console.log(entries);
  t.is(entries.length, 6);
  t.is(entries[0].equals(entries[2]), true);
  t.is(entries[0].equals(entries[4]), true);
  t.is(entries[1].equals(entries[3]), true);
  t.is(entries[1].equals(entries[5]), true);
});

test('Can check whether entry is balanced', t => {
  const good = shortcutToEntries('10 ETH ^revenue', TX);
  t.is(good[0].isBalanced(), true);
  t.is(good[1].isBalanced(), true);

  // invalid because it is in the same account and is the same currency
  const bad = shortcutToEntries('10 ETH', TX); 
  t.is(bad[0].isBalanced(), false);
  t.is(bad[1].isBalanced(), false);
});
