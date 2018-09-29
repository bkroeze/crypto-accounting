import test from 'ava';

import Entry, {
  shortcutToEntries,
  flexibleToEntries,
  objectToEntries,
  makeEntries,
} from '../../src/models/entry';
import Transaction from '../../src/models/transaction';

const TX = new Transaction({
  utc: '2018-01-01',
  account: 'test',
});

test('Entry can instantiate via props', (t) => {
  const note = 'test note';
  const e = new Entry({
    transaction: TX,
    quantity: 1,
    currency: 'BTC',
    note,
  });
  t.is(e.transaction, TX);
  t.is(e.note, note);
});

test('Entry can instantiate a full set of props', (t) => {
  const props = {
    quantity: 1,
    currency: 'BTC',
    type: 'debit',
    account: 'revenue:test',
    note: 'test note 2',
  };
  const e = new Entry({ ...props, transaction: TX });
  t.deepEqual(e.toObject(), {
    ...props,
    id: 'c7cf4888b95846652a9ad42bcbf64276cc37fe3a03b2efe51d5ecd70eec05feb',
    quantity: '1.00000000',
  });
});

test('Entry can instatiate via shortcut', (t) => {
  const e = new Entry({ transaction: TX, shortcut: '100 ETH' });
  t.is(e.quantity.toFixed(0), '100');
  t.is(e.currency, 'ETH');
  t.is(e.getAccount(), 'test');
});

test('Can instantiate a trade pair of entries from a shortcut', (t) => {
  const entries = shortcutToEntries('1 BTC @ 10000 USD', TX);
  t.is(entries.length, 2);
  t.is(entries[0].type, 'debit');
  t.is(entries[0].quantity.toFixed(0), '1');
  t.is(entries[0].currency, 'BTC');
  t.is(entries[1].type, 'credit');
  t.is(entries[1].quantity.toFixed(0), '10000');
  t.is(entries[1].currency, 'USD');
});

test('Can load an object entry with shortcuts', (t) => {
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

test('Can load objects and strings interchangeably', (t) => {
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

test('Can load objects with "entries" member', (t) => {
  const entries = flexibleToEntries({
    entries: [
      {quantity: "1.00000000", currency: "BTC", account: "assets:exchanges:coinbase", type: "debit"},
      {quantity: "20000.00000000", currency: "USD", account: "assets:banks:checking", type: "credit"}
    ]
  }, TX);
  t.is(entries.length, 2);
  t.is(entries[0].quantity.toFixed(0), '1');
  t.is(entries[0].type, 'debit');
  t.is(entries[0].currency, 'BTC');
});

test('Can load a list of mixed types', (t) => {
  const entries = makeEntries([
    {
      debits: ['100 ETH'],
      credits: [{
        quantity: 10000,
        currency: 'USD',
      }],
    },
    '100 ETH @ 100 USD',
    '100 ETH = 10000 USD',
  ], TX);
  t.is(entries.length, 6);
  t.is(entries[0].equals(entries[2]), true);
  t.is(entries[0].equals(entries[4]), true);
  t.is(entries[1].equals(entries[3]), true);
  t.is(entries[1].equals(entries[5]), true);
});

test('Can check whether entry is balanced', (t) => {
  const good = shortcutToEntries('10 ETH ^revenue', TX);
  t.is(good[0].isBalanced(), true);
  t.is(good[1].isBalanced(), true);

  // invalid because it is in the same account and is the same currency
  const bad = shortcutToEntries('10 ETH', TX);
  t.is(bad[0].isBalanced(), false);
  t.is(bad[1].isBalanced(), false);
});

test('Handles negative shortcuts', (t) => {
  const entries = shortcutToEntries('-10 GIN @ 10 USD', TX);
  // console.log(JSON.stringify(entries.map(e => e.toObject()), null, 2));
  t.is(entries.length, 2);
  t.is(entries[1].type, 'credit');
  t.is(entries[1].quantity.toFixed(0), '10');
  t.is(entries[1].currency, 'GIN');
  t.is(entries[0].type, 'debit');
  t.is(entries[0].quantity.toFixed(0), '100');
  t.is(entries[0].currency, 'USD');
});

test('shortcut with tabs', (t) => {
  const tab = '	';
  const e = new Entry({transaction: TX, shortcut: `0.00000370${tab}BTC${tab}Assets:Exchanges:CryptoBridge`});
});

test('Entry.tokenizeShortcut simple', (t) => {
  t.deepEqual(Entry.tokenizeShortcut('10 ETH'), ['10', 'ETH']);
});

test('Entry.tokenizeShortcut $', (t) => {
  t.deepEqual(Entry.tokenizeShortcut('$100'), ['100', 'USD']);
});

test('Entry.tokenizeShortcut comment', (t) => {
  t.deepEqual(Entry.tokenizeShortcut('$100 ; testing'), ['100', 'USD', ';testing']);
  t.deepEqual(Entry.tokenizeShortcut('$100 ; testing one two'), ['100', 'USD', ';testing one two']);
});

test('Entry.tokenizeShortcut account', (t) => {
  t.deepEqual(Entry.tokenizeShortcut('100 BTC Income:Gift'), ['100', 'BTC', 'Income:Gift']);
  t.deepEqual(Entry.tokenizeShortcut('100 BTC Income:Gift ;  test'), ['100', 'BTC', 'Income:Gift', ';test']);
});

test('Can make a full shortcut from a trade pair', (t) => {
  const entries = shortcutToEntries('10 GIN @ 10 USD bank', TX);
  t.is(entries[0].type, 'debit');
  t.is(entries[0].getFullShortcut(), '10 GIN @ 10 USD bank');
  t.is(entries[1].quantity.toFixed(0), '100');
  t.is(entries[1].getFullShortcut(), '10 USD bank');
});
