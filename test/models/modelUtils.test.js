import test from 'ava';
import { stripFalsyExcept, getAccountPathMap, getAccountAliasMap } from '../../src/models/modelUtils';

test('StripFalsy simple', (t) => {
  const raw = {
    lame: null,
    bad: 0,
    empty: '',
    that: 1,
    theother: 'x',
  };
  const stripped = stripFalsyExcept(raw);
  t.deepEqual(stripped, {
    that: 1,
    theother: 'x',
  });
});

test('StripFalsy with exceptions', (t) => {
  const raw = {
    lame: null,
    bad: 0,
    empty: '',
    that: 1,
    theother: 'x',
  };
  const stripped = stripFalsyExcept(raw, ['bad', 'empty', 'missing']);
  t.deepEqual(stripped, {
    bad: 0,
    empty: '',
    that: 1,
    theother: 'x',
  });
});

test('getAccountPathMap flattens', (t) => {
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
  const result = getAccountPathMap(accounts);
  //console.log('results', JSON.stringify(result, null, 2));
  t.deepEqual(result, {
    top: {
      path: 'top',
      children: {
        one: {
          path: 'top:one',
        },
        two: {
          path: 'top:two',
          children: {
            three: {
              path: 'top:one:three',
            },
          },
        },
      }
    },
    'top:one': {
      path: 'top:one',
    },
    'top:two': {
      path: 'top:two',
      children: {
        three: {
          path: 'top:one:three',
        },
      },
    },
    'top:one:three': {
      path: 'top:one:three',
    },
    next: {
      path: 'next',
    },
  });
});

test('getAccountAliasMap gets aliases', (t) => {
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
  const result = getAccountAliasMap(accounts);
  // console.log('results', JSON.stringify(result, null, 2));
  t.deepEqual(result, {
    one: {
      path: 'top:one',
      aliases: ['one'],
    },
    two: {
      path: 'top:two',
      aliases: ['two'],
      children: {
        three: {
          path: 'top:one:three',
        },
      },
    },
    n: {
      path: 'next',
      aliases: ['n'],
    },
  });

});
