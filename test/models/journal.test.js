import test from 'ava';
import Moment from 'moment';

import Journal from '../../src/models/journal';
import { journalFinder } from '../utils';

const getJournalFromYaml = journalFinder(__dirname);

test('Should get accounts', (t) => {
  const work = {
    accounts: {
      test: {
        note: 'test a',
        children: {
          revenue: {
            note: 'test b',
          },
        },
      },
    },
    currencies: {
      BTC: {
        id: 'BTC',
        name: 'Bitcoin',
      },
      ETH: {
        id: 'ETH',
        name: 'Ethereum',
      },
    },
    transactions: [{
      utc: '2018-01-01T01:01:01.001Z',
      account: 'test',
      entries: ['100 ETH test:revenue'],
    }],
  };
  const journal = new Journal(work);
  const testAcc = journal.getAccount('test');
  t.truthy(testAcc);
});

test('Should get account by alias', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const acct = journal.getAccount('cb');
  t.is(acct.path, "assets:exchanges:coinbase");
});

test('Should render toObject', (t) => {
  const work = {
    accounts: {
      test: {
        note: 'test a',
      },
      revenue: {
        note: 'test b',
      },
    },
    currencies: {
      BTC: {
        id: 'BTC',
        name: 'Bitcoin',
      },
      ETH: {
        id: 'ETH',
        name: 'Ethereum',
      },
    },
    transactions: [{
      utc: '2018-01-01T01:01:01.001Z',
      account: 'test',
      fees: [],
      tags: [],
      entries: ['100 ETH revenue'],
    }],
  };
  const journal = new Journal(work);
  // console.log(JSON.stringify(journal.toObject(), null, 2));
  const debit = {
    quantity: '100.00000000',
    currency: 'ETH',
    account: 'test',
    type: 'debit',
    pair: {
      quantity: '100.00000000',
      currency: 'ETH',
      account: 'revenue',
      type: 'credit',
    },
  };
  const credit = {
    quantity: '100.00000000',
    currency: 'ETH',
    account: 'revenue',
    type: 'credit',
    pair: {
      quantity: '100.00000000',
      currency: 'ETH',
      account: 'test',
      type: 'debit',
    },
  };

  t.deepEqual(journal.toObject(), {
    accounts: {
      test: {
        path: 'test',
        note: 'test a',
        tags: [],
        children: {},
        entries: [debit],
      },
      revenue: {
        path: 'revenue',
        note: 'test b',
        tags: [],
        children: {},
        entries: [credit],
      },
    },
    currencies: {
      BTC: {
        id: 'BTC',
        name: 'Bitcoin',
      },
      ETH: {
        id: 'ETH',
        name: 'Ethereum',
      },
    },
    transactions: [
      {
        account: {
          debit: 'test',
          credit: 'test',
        },
        utc: '2018-01-01T01:01:01.001Z',
        tags: [],
        entries: [debit, credit],
        fees: [],
      },
    ],
  });
});

test('Simple fixture test', (t) => {
  const journal = getJournalFromYaml('journal_1.yaml');
  t.truthy(journal, 'Should have loaded a journal');
  const exchanges = journal.getAccount('assets:exchanges');
  const total = exchanges.getTotalBalances();
  t.is(total.ETH.toFixed(1), '3.0');

  const byAccount = journal.getBalancesByAccount();
  t.is(byAccount['assets:exchanges:coinbase'].ETH.toFixed(2), '1.00');
  t.is(byAccount['assets:exchanges:binance'].ETH.toFixed(2), '2.00');
});

test('Tracks sales through multiple hops', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const byAccount = journal.getBalancesByAccount();
  // console.log(`byAccount ${JSON.stringify(byAccount, null, 2)}`);
  const coinbase = byAccount['assets:exchanges:coinbase'];
  const binance = byAccount['assets:exchanges:binance'];
  t.is(coinbase.ETH.toFixed(2), '0.10');
  t.is(coinbase.USD.toFixed(2), '60.00');
  t.is(binance.ETH.toFixed(1), '0.0');
  t.is(binance.GIN.toFixed(1), '0.0');
});

test('getBalancesByAccount can apply filters', (t) => {
  const journal = getJournalFromYaml('journal_mining.yaml');
  const total = journal.getBalancesByAccount();
  t.is(total['assets:wallets:ETH'].ETH.toFixed(3), '0.005');

  const day3 = Moment('2018-06-03');
  const threeDays = journal.getBalancesByAccount(e => e.getUtc().isSameOrBefore(day3));
  t.is(threeDays['assets:wallets:ETH'].ETH.toFixed(3), '0.003');
});

test('getBalancesByCurrency is accurate for multiple accounts', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const byCurrency = journal.getBalancesByCurrency();
  //console.log(`byCurrency ${JSON.stringify(byCurrency, null, 2)}`);
  t.is(byCurrency.USD.quantity.toFixed(0), '560');
  t.deepEqual(byCurrency.USD.accounts, ['assets:banks:checking', 'assets:exchanges:coinbase', 'equity'])
  t.is(byCurrency.ETH.quantity.toFixed(2), '0.10');
});

test('getBalancesByCurrency can use filters', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const byCurrency = journal.getBalancesByCurrency(e => e.account !== 'equity');
  //console.log(`byCurrency ${JSON.stringify(byCurrency, null, 2)}`);
  t.is(byCurrency.USD.quantity.toFixed(0), '1060');
  t.deepEqual(byCurrency.USD.accounts, ['assets:banks:checking', 'assets:exchanges:coinbase'])
  t.is(byCurrency.ETH.quantity.toFixed(2), '0.10');
});
