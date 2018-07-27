import test from 'ava';
import * as sets from '../../src/utils/sets';

test('should merge two sets', t => {
  const a = new Set([1,2,3]);
  const b = new Set([3,4,5]);
  const c = sets.setUnion(a, b);
  t.is(c.size, 5);
  for (let i = 1; i < 6; i++) {
    t.true(c.has(i));
  }
  t.false(c.has(0));
});

test('should merge multiple sets', t => {
  const accum = [];
  const work = [];
  // making silly big sets for merging
  for (let i=1; i<101; i++) {
    accum.push(i);
    work.push(new Set([...accum]));
  }
  const merged = sets.mergeSets(work);
  t.is(merged.size, 100);
  for (let j=1; j<101; j++) {
    t.true(merged.has(j));
  }
});

test('should find difference', t => {
  const a = new Set([1,2,3]);
  const b = new Set([3,4,5]);
  const c = sets.setDifference(a, b);
  t.is(c.size, 2);
  t.true(c.has(1));
  t.true(c.has(2));
  t.false(c.has(3));
  t.false(c.has(4));
  t.false(c.has(5));
});
