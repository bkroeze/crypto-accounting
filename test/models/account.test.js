import test from 'ava';
import { safeDump } from 'js-yaml';

import Account, { makeAccounts } from '../../src/models/account';
import Transaction from '../../src/models/transaction';
import { objectValsToObject } from '../../src/models/modelUtils';
import { journalFinder } from '../utils';
import Moment from 'moment';

test('Account can instantiate via props', t => {
  const a = new Account({path: 'test'});
  t.is(a.path, 'test');
});

test('Account can instantiate a full set of props w/o children', t => {
  const props = {path: 'test', alias: 't', note: 'notes are nice', tags: [], portfolio: [],
                 children: {}}
  const a = new Account(props);
  t.deepEqual(a.toObject(), { ...props, entries: []});
});

test('Account can instantiate a full set of props with children', t => {
  const props = {path: 'test', alias: 't', note: 'notes are nice', tags: [], portfolio: [],
                 children: {
                   c1: {
                     path: 'c1', alias: 'c1', tags: [], portfolio: [],
                     children: {}},
                   c2: {
                     path: 'c2', alias: 'c2', note: 'xxx', tags: [], portfolio: [],
                     children: {}},
                 }};
  const a = new Account(props);
  t.is(a.children.c1.alias, 'c1');
  t.is(a.children.c1.path, 'test:c1');

  // add the prefix to the path for deep equal test
  props.children.c1.path = 'test:c1';
  props.children.c2.path = 'test:c2';
  props.entries = [];
  props.children.c1.entries = [];
  props.children.c2.entries = [];
  t.deepEqual(a.toObject(), { ...props, entries: []});
});

test('Account can instantiate a full set of props with multiple children levels', t => {
  const props = {path: 'test', alias: 't', note: 'notes are nice', tags: [], portfolio: 'test',
                 children: {
                   c1: {
                     path: 'c1', alias: 'c1', note: '', tags: [], portfolio: 'test',
                     children: {
                       c2: {
                         path: 'c2', alias: 'c2', note: 'xxx', tags: [], portfolio: 'test', 
                         children: {
                           c3: {
                             path: 'c3', alias: 'c3', note: '', tags: [], portfolio: 'test', 
                             children: []},
                         }
                       }
                     }
                   }
                 }
                };
  const a = new Account(props);
  const child1 = a.children.c1;
  const child1_1 = child1.children.c2;
  const child1_1_1 = child1_1.children.c3;
  t.is(child1.alias, 'c1');
  t.is(child1.path, 'test:c1');
  t.is(child1_1.path, 'test:c1:c2');
  t.is(child1_1_1.path, 'test:c1:c2:c3');

  t.is(child1.parent, a);
  t.is(child1_1.parent, child1);
  t.is(child1_1_1.parent, child1_1);
});

test('makeAccounts will load a raw object into an Accounts object', t => {
  const raw = {
    top1: {
      children: {
        a1: {note: 'test one'},
        b1: {note: 'test two'},
      },
    },
    top2: {
      children: {
        a2: {
          children: {
            aa2: {note: 'top2.a2.aa2'}
          }
        }
      }
    }
  };
  const accounts = makeAccounts(raw);
  t.deepEqual(objectValsToObject(accounts), {
    'top1': {
      path: 'top1',
      tags: [],
      entries: [],
      children: {
        'a1': {
          children: {},
          tags: [],
          path: 'top1:a1',
          note: 'test one',
          entries: [],
        },
        'b1': {
          children: {},
          tags: [],
          path: 'top1:b1',
          note: 'test two',
          entries: [],
        }
      }
    },
    'top2': {
      path: 'top2',
      tags: [],
      entries: [],
      children: {
        'a2': {
          path: 'top2:a2',
          tags: [],
          entries: [],
          children: {
            'aa2': {
              children: {},
              tags: [],
              path: 'top2:a2:aa2',
              note: 'top2.a2.aa2',
              entries: [],
            }
          }
        }
      }
    }
  });
});

test('Accounts can get simple balances', t => {
  const account = new Account({path: 'test'});
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
    entries: ['100 ETH @ .2 BTC']
  });
  account.addEntry(tx.entries[0]);
  account.addEntry(tx.entries[1]);
  const balances = account.getBalances();
  const keys = Object.keys(balances);
  keys.sort();
  t.deepEqual(keys, ['BTC', 'ETH']);
  t.is(balances.BTC.toFixed(2), '-20.00');
  t.is(balances.ETH.toFixed(2), '100.00');
});

test('Accounts can get balances with or without children', t => {
  const account = new Account({path: 'test', children: {
    child: {note: 'test'}
  }});
  const tx = new Transaction({
    utc: '2018-01-01',
    account: 'test',
    entries: ['100 ETH @ .2 BTC']
  });
  account.addEntry(tx.entries[0]);
  account.addEntry(tx.entries[1]);

  const tx2 = new Transaction({
    utc: '2018-01-01',
    account: 'test:child',
    entries: ['0.2 BTC @ 5 ETH']
  });

  const {child} = account.children;
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
  t.is(byAccount['test'].BTC.toFixed(0), '-20');
  t.is(byAccount['test:child'].ETH.toFixed(0), '-1');
});

const getJournal = journalFinder(__dirname);

test('getBalances can apply filters', t => {
  const journal = getJournal('journal_mining.yaml');
  const acct = journal.getAccount('assets:wallets:ETH');
  const total = acct.getBalances();
  t.is(total.ETH.toFixed(3), '0.005');

  const day3 = Moment('2018-06-03');
  const threeDays = acct.getBalances({}, (e) => e.getUtc().isSameOrBefore(day3));
  t.is(threeDays.ETH.toFixed(3), '0.003');
});
