import test from 'ava';
import Account, { makeAccounts } from '../../src/models/account';
import { objectValsToObject } from '../../src/models/modelUtils';

test('Account can instantiate via props', t => {
  const a = new Account({path: 'test'});
  t.is(a.path, 'test');
});

test('Account can instantiate a full set of props w/o children', t => {
  const props = {path: 'test', alias: 't', note: 'notes are nice', tags: [], portfolio: [],
                 children: {}}
  const a = new Account(props);
  t.deepEqual(a.toObject(), props);
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
  t.deepEqual(a.toObject(), props);
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

test('makeAccounts will load yaml into an Accounts object', t => {
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
      children: {
        'a1': {
          children: {},
          tags: [],
          path: 'top1:a1',
          note: 'test one',
        },
        'b1': {
          children: {},
          tags: [],
          path: 'top1:b1',
          note: 'test two',
        }
      }
    },
    'top2': {
      path: 'top2',
      tags: [],
      children: {
        'a2': {
          path: 'top2:a2',
          tags: [],
          children: {
            'aa2': {
              children: {},
              tags: [],
              path: 'top2:a2:aa2',
              note: 'top2.a2.aa2',
            }
          }
        }
      }
    }
  });
});
