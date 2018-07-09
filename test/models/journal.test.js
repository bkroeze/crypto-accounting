import test from 'ava';
import Moment from 'moment';

import Journal from '../../src/models/journal';
import { BIG_0 } from '../../src/utils/numbers';
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
  t.true(journal.getAccount('equity').isVirtual());
  t.false(journal.getAccount('cb').isVirtual());
  const byCurrency = journal.getBalancesByCurrency();
  //console.log(`byCurrency ${JSON.stringify(byCurrency, null, 2)}`);
  t.is(byCurrency.USD.quantity.toFixed(0), '1060');
  t.deepEqual(Object.keys(byCurrency.USD.accounts), ['assets:banks:checking', 'assets:exchanges:coinbase']);
  t.is(byCurrency.ETH.quantity.toFixed(2), '0.10');
});

test('getBalancesByCurrency can use filters', (t) => {
  const journal = getJournalFromYaml('journal_mining.yaml');
  const day3 = Moment('2018-06-03');
  const byCurrency = journal.getBalancesByCurrency((e) => {
    return e.getUtc().isSameOrBefore(day3) && !e.inAccount('revenue');
  });
  t.is(byCurrency.ETH.quantity.toFixed(3), '0.003');
});

test('Testing with virtual entries', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const equity = journal.getAccount('equity:test');
  const cb = journal.getAccount('cb');
  t.is(cb.getBalancingAccount(), 'equity:test');
  const byCurrency = journal.getBalancesByCurrency(null, true);
  t.true(byCurrency.USD.quantity.eq(BIG_0));
  t.true(byCurrency.ETH.quantity.eq(BIG_0));
});

test('Lots have remaining balances calculated', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const lots = journal.accounts.getLots(journal.currencies);
  // console.log('lots');
  // lots.forEach((l) => {
  //   console.log(l.toObject());
  // });
  t.is(lots.length, 4);
  const remaining = lots[0].getRemaining();
  t.is(lots[0].getRemaining().toFixed(1), '0.0');
  t.is(lots[0].currency, 'ETH');
  t.is(lots[1].getRemaining().toFixed(1), '0.0');
  t.is(lots[1].currency, 'GIN');
  t.is(lots[2].getRemaining().toFixed(1), '0.0');
  t.is(lots[2].currency, 'ETH');
  t.is(lots[3].getRemaining().toFixed(1), '0.1');
  t.is(lots[3].currency, 'ETH');
});

test('Can get lots by currency', (t) => {
  const journal = getJournalFromYaml('journal_2.yaml');
  const lots = journal.getLotsByCurrency();
  t.is(lots.ETH.length, 3);
  t.is(lots.GIN.length, 1);
});
