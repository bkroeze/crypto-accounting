import test from 'ava';

import {Posting, shortcutToPostings} from '../../src/models/posting';

test('Posting can instantiate via non-shortcut props', t => {
  const p = new Posting({quantity: 1, currency: 'BTC'});
  t.is(p.quantity.toFixed(2), '1.00');
  t.is(p.currency, 'BTC');
  t.is(p.toString(), '1.00000000 BTC');
});

test('Posting can instantiate via shortcut prop simple', t => {
  let p = new Posting('10.23 ETH');
  t.is(p.quantity.toFixed(3), '10.230');
  t.is(p.currency, 'ETH');

  p = new Posting('ETH 10.23');
  t.is(p.quantity.toFixed(3), '10.230');
  t.is(p.currency, 'ETH');
});

test('Single postings are created from shortcut without connector', t => {
  const postings = shortcutToPostings('5 MARCO');
  t.is(postings.debits.length, 1);
  t.is(postings.credits.length, 0);
  const p = postings.debits[0];
  t.is(p.quantity.toFixed(1), '5.0');
  t.is(p.currency, 'MARCO');
});

test('Accounts are automatically grabbed from shortcuts', t => {
  let p = new Posting('10.23 ETH ^revenue:mining');
  t.is(p.quantity.toFixed(3), '10.230');
  t.is(p.currency, 'ETH');
  t.is(p.account, 'revenue:mining');
});

test('Pairs of postings are created from shortcut', t => {
  const postings = shortcutToPostings('1 BTC @ 20000 USD');
  t.is(postings.debits.length, 1);
  t.is(postings.credits.length, 1);
  t.is(postings.debits[0].quantity.toFixed(1), '1.0');
  t.is(postings.debits[0].currency, 'BTC');
  t.is(postings.credits[0].quantity.toFixed(2), '20000.00')
  t.is(postings.credits[0].currency, 'USD');
});

test('Pairs of postings with accounts are created from shortcut', t => {
  const postings = shortcutToPostings('1 BTC @ 20000 USD ^assets:bank');
  t.is(postings.debits.length, 1);
  t.is(postings.credits.length, 1);
  t.is(postings.debits[0].quantity.toFixed(1), '1.0');
  t.is(postings.debits[0].currency, 'BTC');
  t.is(postings.debits[0].account, '');
  t.is(postings.debits[0].type, 'debit');
  t.is(postings.credits[0].quantity.toFixed(2), '20000.00')
  t.is(postings.credits[0].currency, 'USD');
  t.is(postings.credits[0].account, 'assets:bank')
  t.is(postings.credits[0].type, 'credit')
});

test('Pairs of postings with account on debit side are created from shortcut', t => {
  const postings = shortcutToPostings('1 BTC ^assets:test @ 20000 USD');
  t.is(postings.debits.length, 1);
  t.is(postings.credits.length, 1);
  t.is(postings.debits[0].quantity.toFixed(1), '1.0');
  t.is(postings.debits[0].currency, 'BTC');
  t.is(postings.debits[0].account, 'assets:test');
  t.is(postings.debits[0].type, 'debit');
  t.is(postings.credits[0].quantity.toFixed(2), '20000.00')
  t.is(postings.credits[0].currency, 'USD');
  t.is(postings.credits[0].account, '');
  t.is(postings.credits[0].type, 'credit');
});

