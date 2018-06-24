import test from 'ava';

import Journal from '../../src/models/journal';

test('Should render toObject', t => {
  const work = {
    accounts: {
      testa: {
        path: 'testa',
        tags: [],
        note: 'test a',
        children: {},
      },
      testb: {
        path: 'testb',
        tags: [],
        note: 'test b',
        children: {},
      }
    },
    currencies: {
      BTC: {
        id: 'BTC',
        name: 'Bitcoin'
      },
      ETH: {
        id: 'ETH',
        name: 'Ethereum'
      },
    },
    transactions: [{
      utc: '2018-01-01T01:01:01.001Z',
      account: 'test',
      fees: [],
      tags: [],
      entries: ['100 ETH'],
    }],
  };
  const journal = new Journal(work);
  work.transactions[0].entries = [{
    account: 'test',
    currency: 'ETH',
    quantity: '100.00000000',
    type: 'debit',
  }];
  work.transactions[0].account = {
    credit: 'test',
    debit: 'test',
  }
  t.deepEqual(journal.toObject(), work);
});
