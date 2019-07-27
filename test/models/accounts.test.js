import test from 'ava';
import { Accounts } from '../../src/models/accounts';
import { journalFinder } from '../utils';

const getJournal = journalFinder(__dirname);

test('Accounts.paths is flat', (t) => {
  const accounts = {
    top: {
      path: 'top',
      children: {
        one: { path: 'top:one' },
        two: {
          path: 'top:two',
          children: {
            three: { path: 'top:one:three'}
          }
        },
      }
    },
    next: {
      path: 'next'
    }
  };
  const accts = new Accounts(accounts);
  accts.calculatePaths();
  //console.log('results', JSON.stringify(accts.paths, null, 2));
  const keys = Object.keys(accts.paths);
  keys.sort();
  t.deepEqual(keys, ['next', 'top', 'top:one', 'top:two', 'top:two:three']);
});

test('calculates aliases', (t) => {
  const accounts = {
    top: {
      path: 'top',
      children: {
        one: { path: 'top:one', aliases: ['one'] },
        two: {
          path: 'top:two',
          aliases: ['two'],
          children: {
            three: { path: 'top:one:three'}
          }
        },
      }
    },
    next: {
      path: 'next',
      aliases: ['n'],
    }
  };
  const accts = new Accounts(accounts);
  accts.calculatePaths();
  // console.log('results', JSON.stringify(result, null, 2));
  const keys = Object.keys(accts.aliases);
  keys.sort();
  t.deepEqual(keys, ['n', 'one', 'two']);
});

test('Accounts.filters applies filters', (t) => {
  const accounts = {
    top: {
      path: 'top',
      children: {
        one: { path: 'top:one', note: 'test' },
        two: {
          path: 'top:two',
          children: {
            three: { path: 'top:one:three'}
          }
        },
      }
    },
    next: {
      path: 'next',
      children: {
        one: { path: 'next:one', note: 'test' },
      },
    }
  };

  function hasNote(account) {
    return !!account.note;
  }
  const accts = new Accounts(accounts);
  const found = accts.filter(hasNote);
  t.is(found.length, 2);
  t.is(found[0].path, 'next:one');
  t.is(found[1].path, 'top:one');
});

test('loading a raw object into an Accounts object', (t) => {
  const raw = {
    top1: {
      children: {
        a1: { note: 'test one' },
        b1: { note: 'test two' },
      },
    },
    top2: {
      children: {
        a2: {
          children: {
            aa2: { note: 'top2.a2.aa2' },
          },
        },
      },
    },
  };
  const accounts = new Accounts(raw);
  t.deepEqual(accounts.toObject(), {
    top1: {
      path: 'top1',
      children: {
        a1: {
          path: 'top1:a1',
          note: 'test one',
        },
        b1: {
          path: 'top1:b1',
          note: 'test two',
        },
      },
    },
    top2: {
      path: 'top2',
      children: {
        a2: {
          path: 'top2:a2',
          children: {
            aa2: {
              path: 'top2:a2:aa2',
              note: 'top2.a2.aa2',
            },
          },
        },
      },
    },
  });
});

test('getLots', (t) => {
  const journal = getJournal('journal_2.yaml');
  const lots = journal.accounts.getLots(journal.currencies)
  //console.log(lots.map(l => l.toObject(true)));
  t.is(lots.length, 4);
  t.deepEqual(lots.map(l => [l.account, l.currency, l.getTotal().toFixed(1)]),
              [
                ['assets:exchanges:coinbase', 'ETH', '1.1'],
                ['assets:exchanges:binance', 'GIN', '40.0'],
                ['assets:exchanges:binance', 'ETH', '1.0'],
                ['assets:exchanges:binance', 'ETH', '1.0']
              ]);

});
