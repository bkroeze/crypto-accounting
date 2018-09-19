import test from 'ava';

import Transaction from '../../src/models/transaction';

test('Transaction can instantiate via props', (t) => {
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
  });
  t.deepEqual(tx.account, { credit: 'test', debit: 'test' });
});

test('Transaction can instantiate a full set of props', (t) => {
  const props = {
    id: 'test',
    note: 'notes are nice',
    account: {
      credit: 'income:test',
      debit: 'assets:bank',
    },
    utc: '2018-12-25T00:00:00.000Z',
    tags: ['test'],
    party: 'Mr. Happy',
    address: 12345,
    entries: [],
  };
  const tx = new Transaction(props);
  t.deepEqual(tx.toObject(), props);
});

test('Transaction with entries are loaded', (t) => {
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
    entries: ['10 ETH income'],
    details: {
      zip: 'zap',
    },
  });
  t.deepEqual(tx.account, { credit: 'test', debit: 'test' });
  t.is(tx.entries.length, 2);
  t.is(tx.isBalanced(), true);
});

test('makeBalancedPair from Credit', t => {
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
  });
  const pair = tx.makeBalancedPair('1 BTC foo', true);
  const {credit, debit} = pair;
  t.is(credit.quantity.toFixed(0), '1');
  t.is(credit.getAccount(), 'test');
  t.is(debit.quantity.toFixed(0), '1');
  t.is(debit.getAccount(), 'foo');
});

test('makeBalancedPair from Debit', t => {
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
  });
  const pair = tx.makeBalancedPair('1 BTC foo', false);
  const {credit, debit} = pair;
  t.is(credit.quantity.toFixed(0), '1');
  t.is(credit.getAccount(), 'foo');
  t.is(debit.quantity.toFixed(0), '1');
  t.is(debit.getAccount(), 'test');
});

test('load debit entries', t => {
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
    debits: ['10 ETH income'],
  });
  t.is(tx.entries.length, 2);
  t.is(tx.entries[0].getAccount(), 'income');
  t.is(tx.entries[0].type, 'credit')
  t.is(tx.entries[1].getAccount(), 'test');
  t.is(tx.entries[1].type, 'debit');
})
