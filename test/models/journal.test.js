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
      entries: ['100 ETH ^revenue'],
    }],
  };
  const journal = new Journal(work);
  //console.log(JSON.stringify(journal.toObject(), null, 2));
  t.deepEqual(journal.toObject(),{
    "accounts": {
      "testa": {
        "path": "testa",
        "note": "test a",
        "tags": [],
        "children": {}
      },
      "testb": {
        "path": "testb",
        "note": "test b",
        "tags": [],
        "children": {}
      }
    },
    "currencies": {
      "BTC": {
        "id": "BTC",
        "name": "Bitcoin"
      },
      "ETH": {
        "id": "ETH",
        "name": "Ethereum"
      }
    },
    "transactions": [
      {
        "account": {
          "debit": "test",
          "credit": "test"
        },
        "utc": "2018-01-01T01:01:01.001Z",
        "tags": [],
        "entries": [
          {
            "quantity": "100.00000000",
            "currency": "ETH",
            "account": "test",
            "type": "debit",
            "pair": {
              "quantity": "100.00000000",
              "currency": "ETH",
              "account": "revenue",
              "type": "credit"
            }
          },
          {
            "quantity": "100.00000000",
            "currency": "ETH",
            "account": "revenue",
            "type": "credit",
            "pair": {
              "quantity": "100.00000000",
              "currency": "ETH",
              "account": "test",
              "type": "debit"
            }
          }
        ],
        "fees": []
      }
    ]
  });
});
