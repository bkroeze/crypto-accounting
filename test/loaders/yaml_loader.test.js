import test from 'ava';
import { safeDump } from 'js-yaml';

import { findRefs, loadRefs, setMockFS } from '../../src/loaders/yaml_loader';
import MockFS from '../mockfs';

test('basic finding of refs', t => {
  const refs = findRefs({
    $ref: 'test'
  });

  t.deepEqual(refs, [{path: [], link: 'test'}]);
});

test('finds refs one deep', t => {
  const refs = findRefs({
    first: {
      test: 'toast',
      $ref: 'one',
    },
    second: {
      test: 'toast',
      $ref: 'two'
    }
  });
  t.deepEqual(refs, [
    {
      path: ['first'],
      link: 'one'
    },{
      path: ['second'],
      link: 'two'
    }
  ]);
});

test('finds refs three deep', t => {
  const refs = findRefs({
    first: {
      test: 'toast',
      second: {
        $ref: 'two',
        third: {
          $ref: 'three'
        }
      }
    },
  });
  t.deepEqual(refs, [
    {
      path: ['first','second'],
      link: 'two'
    },{
      path: ['first','second','third'],
      link: 'three'
    }
  ]);
});

test('Can load an array from a $ref', t => {
  const work = {
    top: {
      '$ref': 'top.yaml'
    }
  }
  const yaml = '- one\n- two';
  const mockfs = new MockFS({'x/top.yaml': yaml});
  setMockFS(mockfs);
  const result = loadRefs(work, 'x');
  t.deepEqual(result, {
    top: ['one', 'two'],
  });
  setMockFS(null);
});

test('Can load an object from $ref', t => {
  const work = {
    top: {
      '$ref': 'top.yaml'
    }
  }
  const yaml = 'one: 1\ntwo: 2';
  const mockfs = new MockFS({'x/top.yaml': yaml});
  setMockFS(mockfs);
  const result = loadRefs(work, 'x');
  t.deepEqual(result, {
    top: {'one': 1, 'two': 2},
  });
  setMockFS(null);
});

test('can load $refs in $refs', t => {
  const work = {
    top: {
      '$ref': 'top.yaml'
    }
  }

  const top = 'inner:\n  $ref: ./y/inner.yaml\n';
  const yaml = 'one: 1\ntwo: 2';
  const mockfs = new MockFS({
    'x/top.yaml': top,
    'x/y/inner.yaml': yaml,
  });
  setMockFS(mockfs);
  const result = loadRefs(work, 'x');
  t.deepEqual(result, {
    top: {
      inner: {
        'one': 1,
        'two': 2
      }
    },
  });
  setMockFS(null);
});

test('finds list $refs', t => {
  const work = {
    '$ref': ['a','b']
  };
  const refs = findRefs(work);
  t.is(refs.length, 1);
  t.deepEqual(refs[0].link, ['a','b']);
});

test('Can load a list of $refs to an object', t => {
  const top = {
    top: {
      '$ref': ['one.yaml', 'two.yaml']
    }
  };

  const one = safeDump({
    a: 'test a'
  });

  const two = safeDump({
    b: 'test b'
  });

  const mockfs = new MockFS({
    'top.yaml': top,
    'one.yaml': one,
    'two.yaml': two,
  });
  setMockFS(mockfs);
  const result = loadRefs(top, '');
  t.deepEqual(result, {
    top: {a: 'test a', b: 'test b'},
  });
  setMockFS(null);
});

test('Can load a list of $refs to an array', t => {
  const top = {
    top: {
      '$ref': ['one.yaml', 'two.yaml']
    }
  };

  const one = safeDump([1,2,3]);

  const two = safeDump([4,5,6]);

  const mockfs = new MockFS({
    'top.yaml': top,
    'one.yaml': one,
    'two.yaml': two,
  });
  setMockFS(mockfs);
  const result = loadRefs(top, '');
  t.deepEqual(result, {
    top: [1,2,3,4,5,6]
  });
  setMockFS(null);
});
