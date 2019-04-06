import test from 'ava';
import Moment from 'moment';

import Account from '../../src/models/account';
import Transaction from '../../src/models/transaction';
import { journalFinder } from '../utils';

const getJournal = journalFinder(__dirname);

test('Account can instantiate via props', (t) => {
  const a = new Account({ path: 'test' });
  t.is(a.path, 'test');
});

test('Account can instantiate a full set of props w/o children', (t) => {
  const props = {
    path: 'test',
    aliases: ['t'],
    note: 'notes are nice',
  };
  const a = new Account(props);
  t.deepEqual(a.toObject(), props);
});

test('Account can instantiate a full set of props with children', (t) => {
  const props = {
    path: 'test',
    aliases: ['t'],
    note: 'notes are nice',
    details: {
      foo: 'bar',
      zip: 'zap',
    },
    children: {
      c1: {
        path: 'c1',
        aliases: ['c1'],
      },
      c2: {
        path: 'c2',
        aliases: ['c2'],
        note: 'xxx',
        tags: ['foo'],
        portfolio: ['gold'],
      },
    },
  };
  const a = new Account(props);
  t.is(a.children.c1.aliases[0], 'c1');
  t.is(a.children.c1.path, 'test:c1');

  // add the prefix to the path for deep equal test
  props.children.c1.path = 'test:c1';
  props.children.c2.path = 'test:c2';
  t.deepEqual(a.toObject(), props);
});

test('Account can instantiate a full set of props with multiple children levels', (t) => {
  const props = {
    path: 'test',
    aliases: ['t'],
    note: 'notes are nice',
    tags: [],
    portfolio: 'test',
    children: {
      c1: {
        path: 'c1',
        aliases: ['c1'],
        note: '',
        tags: [],
        portfolio: 'test',
        children: {
          c2: {
            path: 'c2',
            aliases: ['c2'],
            note: 'xxx',
            tags: [],
            portfolio: 'test',
            children: {
              c3: {
                path: 'c3',
                aliases: ['c3'],
                note: '',
                tags: [],
                portfolio: 'test',
                children: [],
              },
            },
          },
        },
      },
    },
  };
  const a = new Account(props);
  const child1 = a.children.c1;
  const child11 = child1.children.c2;
  const child111 = child11.children.c3;
  t.is(child1.aliases[0], 'c1');
  t.is(child1.path, 'test:c1');
  t.is(child11.path, 'test:c1:c2');
  t.is(child111.path, 'test:c1:c2:c3');

  t.is(child1.parent, a);
  t.is(child11.parent, child1);
  t.is(child111.parent, child11);
});

test('Accounts can get simple balances', (t) => {
  const account = new Account({ path: 'test' });
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
    trades: ['100 ETH @ .2 BTC'],
  });
  t.is(tx.entries.length, 2);
  account.addEntry(tx.entries[0]);
  account.addEntry(tx.entries[1]);
  const balances = account.getBalances();
  const keys = Object.keys(balances);
  keys.sort();
  t.deepEqual(keys, ['BTC', 'ETH']);
  t.is(balances.BTC.toFixed(2), '-20.00');
  t.is(balances.ETH.toFixed(2), '100.00');
});

test('Accounts can get balances with or without children', (t) => {
  const account = new Account({
    path: 'test',
    children: {
      child: { note: 'test' },
    },
  });
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
    trades: ['100 ETH @ .2 BTC'],
  });
  account.addEntry(tx.entries[0]);
  account.addEntry(tx.entries[1]);

  const tx2 = new Transaction({
    utc: '2018-01-01',
    account: 'test:child',
    trades: ['0.2 BTC @ 5 ETH'],
  });

  const { child } = account.children;
  child.addEntry(tx2.entries[0]);
  child.addEntry(tx2.entries[1]);

  const noChildBalances = account.getBalances();
  t.is(noChildBalances.BTC.toFixed(2), '-20.00');
  t.is(noChildBalances.ETH.toFixed(2), '100.00');

  const childBalances = child.getBalances();
  t.is(childBalances.BTC.toFixed(2), '0.20');
  t.is(childBalances.ETH.toFixed(2), '-1.00');

  const totals = account.getTotalBalances();
  t.is(totals.BTC.toFixed(2), '-19.80');
  t.is(totals.ETH.toFixed(2), '99.00');

  const byAccount = account.getBalancesByAccount();
  t.is(byAccount.test.BTC.toFixed(0), '-20');
  t.is(byAccount['test:child'].ETH.toFixed(0), '-1');
});

test('getEntries can find types', (t) => {
  const journal = getJournal('journal_mining.yaml');
  const acct = journal.getAccount('assets:wallets:ETH');
  //console.log(JSON.stringify(acct.toObject(), null, 2));
  const debits = acct.getEntries('debit');
  t.is(debits.length, 5);
});


test('getBalances can apply filters', (t) => {
  const journal = getJournal('journal_mining.yaml');
  const acct = journal.getAccount('assets:wallets:ETH');
  const total = acct.getBalances();
  t.is(total.ETH.toFixed(3), '0.005');

  const day3 = Moment.utc('2018-06-03');
  const threeDays = acct.getBalances(e => e.getUtc().isSameOrBefore(day3));
  t.is(threeDays.ETH.toFixed(3), '0.003');
});

test('Account finds and inherits balancingAccount', (t) => {
  const journal = getJournal('journal_mining.yaml');
  const ex = journal.getAccount('assets:exchanges');
  t.is(ex.getBalancingAccount(), 'equity:internet');
  const binance = journal.getAccount('assets:exchanges:binance');
  t.is(binance.getBalancingAccount(), 'equity:internet');
  const coinbase = journal.getAccount('cb');
  t.is(coinbase.getBalancingAccount(), 'equity:test');
});

test('Account finds and inherits virtual', (t) => {
  const journal = getJournal('journal_mining.yaml');
  const equity = journal.getAccount('equity');
  t.true(equity.isVirtual());
  const tv = journal.getAccount('equity:test');
  t.true(tv.isVirtual());
  const tnv = journal.getAccount('equity:testNotVirtual');
  t.false(tnv.isVirtual());
});

test('Accounts can test their path', (t) => {
  const journal = getJournal('journal_mining.yaml');
  const binance = journal.getAccount('assets:exchanges:binance');

  t.true(binance.inPath('assets'));
  t.true(binance.inPath('assets:exchanges'));
  t.true(binance.inPath('assets:exchanges:binance'));
  t.false(binance.inPath('equity'));
});

test('Account.getLots with no entries', (t) => {
  const journal = getJournal('journal_2.yaml');
  const ex = journal.getAccount('assets:exchanges');
  const lots = ex.getLots(journal.currencies);
  t.is(lots.length, 0);
});

test('Account.getLots with entries', (t) => {
  const journal = getJournal('journal_2.yaml');
  const coinbase = journal.getAccount('cb');
  const lots = coinbase.getLots(journal.currencies);
  t.is(lots.length, 1);
  t.is(lots[0].getTotal().toFixed(1), '1.1');
});

test('getLots should not create lots unless it is a transfer in', (t) => {
  const journal = getJournal('journal_2.yaml');
  const acct = journal.getAccount('binance');
  const lots = acct.getLots(journal.currencies);
  t.is(lots.length, 3);
  t.deepEqual(lots.map(l => [l.currency, l.getTotal().toFixed(0)]),
              [['GIN', '40'], ['ETH', '1'], ['ETH', '1']]);
});
