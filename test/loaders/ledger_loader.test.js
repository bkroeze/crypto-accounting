import test from 'ava';

import { loadLedgerTransactions } from '../../src/loaders/ledger_loader';
import MockFS from '../mockfs';

test('Can load a simple set of ledger formatted entries', t => {
  const ledger = `
; test
2018/01/01 * Test
    assets:test  1 USD
    income

2018/01/02 * Test2
    assets:test  1 USD @ 1 GIN
    income
`;
  const result = loadLedgerTransactions(ledger);
  // result.forEach(r => {
  //   console.log(JSON.stringify(r.toObject(), null, 2));
  // });
  t.is(result.length, 2);
  t.deepEqual(result[0].toObject(), {
    account: {
      debit: 'income',
      credit: 'income'
    },
    status: '*',
    utc: '2018-01-01T08:00:00.000Z',
    party: 'Test',
    entries: [
      {
        quantity: '1.00000000',
        currency: 'USD',
        account: 'assets:test',
        type: 'debit',
        pair: {
          quantity: '1.00000000',
          currency: 'USD',
          account: 'income',
          type: 'credit'
        }
      },
      {
        quantity: '1.00000000',
        currency: 'USD',
        account: 'income',
        type: 'credit',
        pair: {
          quantity: '1.00000000',
          currency: 'USD',
          account: 'assets:test',
          type: 'debit'
        }
      }
    ]
  });

  t.deepEqual(result[1].toObject(), {
    account: {
      debit: 'income',
      credit: 'income'
    },
    status: '*',
    utc: '2018-01-02T08:00:00.000Z',
    party: 'Test2',
    entries: [
      {
        quantity: '1.00000000',
        currency: 'USD',
        account: 'income',
        type: 'debit',
        pair: {
          quantity: '1.00000000',
          currency: 'GIN',
          account: 'assets:test',
          type: 'credit'
        }
      },
      {
        quantity: '1.00000000',
        currency: 'GIN',
        account: 'assets:test',
        type: 'credit',
        pair: {
          quantity: '1.00000000',
          currency: 'USD',
          account: 'income',
          type: 'debit'
        }
      }
    ]
  });
});
