import test from 'ava';

import Transaction from '../../src/models/transaction';

test('Transaction can instantiate via props', t => {
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
  });
  t.deepEqual(tx.account, {credit: 'test', debit: 'test'});
});

test('Transaction can instantiate a full set of props', t => {
  const props = {
    id: 'test',
    note: 'notes are nice',
    account: {
      credit: 'income:test',
      debit: 'assets:bank'
    },
    utc: '2018-12-25T00:00:00.000Z',
    tags: ['test'],
    entries: [],
    fees: [],
  };
  const tx= new Transaction(props);
  t.deepEqual(tx.toObject(), props);
});

test('Transaction with entries are loaded', t => {
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
    entries: ['10 ETH ^income']
  });
  t.deepEqual(tx.account, {credit: 'test', debit: 'test'});
  t.is(tx.entries.length, 2);
  t.is(tx.isBalanced(), true);
});
