import test from 'ava';
import { Transaction } from '../../src/models/transaction';
import { Credit } from '../../src/models/credit';

const TX = new Transaction({
  utc: '2018-01-01',
  account: 'test',
});

test('Can instantiate a Credit', t => {
  const c = new Credit({transaction: TX, shortcut: '1 BTC'});
  t.is(c.quantity.toFixed(0), '1');
  t.is(c.type, 'credit');
  t.is(c.currency, 'BTC');
  t.is(c.getAccount(), 'test');
});
