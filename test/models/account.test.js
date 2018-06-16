import test from 'ava';

import Account from '../../src/models/account';

test('Account can instantiate via props', t => {
  const a = new Account({path: 'test'});
  t.is(a.path, 'test');
});

test('Account can instantiate a full set of props w/o children', t => {
  const props = {path: 'test', alias: 't', note: 'notes are nice', children: []}
  const a = new Account(props);
  t.deepEqual(a.toObject(), props);
});

test('Account can instantiate a full set of props with children', t => {
  const props = {path: 'test', alias: 't', note: 'notes are nice', children: [
    {path: 'c1', alias: 'c1', note: '', children: []},
    {path: 'c2', alias: 'c2', note: 'xxx', children: []},
  ]}
  const a = new Account(props);
  t.is(a.children[0].alias, 'c1');
  t.is(a.children[0].path, 'test:c1');

  // add the prefix to the path for deep equal test
  props.children[0].path = 'test:c1';
  props.children[1].path = 'test:c2';
  t.deepEqual(a.toObject(), props);
});

test('Account can instantiate a full set of props with multiple children levels', t => {
  const props = {path: 'test', alias: 't', note: 'notes are nice', children: [
    {path: 'c1', alias: 'c1', note: '', children: [
      {path: 'c2', alias: 'c2', note: 'xxx', children: [
        {path: 'c3', alias: 'c3', note: '', children: []},
      ]}
    ]}
  ]}
  const a = new Account(props);
  const child1 = a.children[0];
  const child1_1 = child1.children[0];
  const child1_1_1 = child1_1.children[0];
  t.is(child1.alias, 'c1');
  t.is(child1.path, 'test:c1');
  t.is(child1_1.path, 'test:c1:c2');
  t.is(child1_1_1.path, 'test:c1:c2:c3');

  t.is(child1.parent, a);
  t.is(child1_1.parent, child1);
  t.is(child1_1_1.parent, child1_1);
});

