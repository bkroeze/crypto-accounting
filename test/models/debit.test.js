import test from 'ava';
import { Transaction } from '../../src/models/transaction';
import { Debit } from '../../src/models/debit';

const TX = new Transaction({
  utc: '2018-01-01',
  account: 'test',
});

test('Can instantiate a Debit', t => {
  const c = new Debit({transaction: TX, shortcut: '1 BTC'});
  t.is(c.quantity.toFixed(0), '1');
  t.is(c.type, 'debit');
  t.is(c.currency, 'BTC');
  t.is(c.getAccount(), 'test');
});
