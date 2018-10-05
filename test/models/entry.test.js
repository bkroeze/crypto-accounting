import test from 'ava';
import { CREDIT, DEBIT } from '../../src/models/constants';
import Entry, {
  shortcutToEntries,
  flexibleToEntries,
  objectToEntries,
  makeEntries,
} from '../../src/models/entry';
import Transaction from '../../src/models/transaction';

const TX = new Transaction({
  utc: '2018-01-01',
  account: 'test',
});

test('Entry can instantiate via props', (t) => {
  const note = 'test note';
  const e = new Entry({
    transaction: TX,
    quantity: 1,
    currency: 'BTC',
    note,
  });
  t.is(e.transaction, TX);
  t.is(e.note, note);
});

test('Entry can instantiate a full set of props', (t) => {
  const props = {
    quantity: 1,
    currency: 'BTC',
    type: 'debit',
    account: 'revenue:test',
    note: 'test note 2',
  };
  const e = new Entry({ ...props, transaction: TX });
  t.deepEqual(e.toObject(), {
    ...props,
    id: 'c7cf4888b95846652a9ad42bcbf64276cc37fe3a03b2efe51d5ecd70eec05feb',
    quantity: '1.00000000',
  });
});

test('Entry can instatiate via shortcut', (t) => {
  const e = new Entry({ transaction: TX, shortcut: '100 ETH' });
  t.is(e.quantity.toFixed(0), '100');
  t.is(e.currency, 'ETH');
  t.is(e.getAccount(), 'test');
});

test('Can load an object entry with shortcuts', (t) => {
  const entries = objectToEntries({
    debits: ['100 ETH', '.01 ETH'],
    credits: [{
      quantity: 10000,
      currency: 'USD',
    }],
  }, TX);
  t.is(entries.length, 3); 
  t.is(entries[0].currency, 'ETH');
  t.is(entries[0].quantity.toFixed(0), '100');
  t.is(entries[0].type, 'debit');
  t.is(entries[1].quantity.toFixed(2), '0.01');
  t.is(entries[1].type, 'debit');
  t.is(entries[2].quantity.toFixed(0), '10000');
  t.is(entries[2].currency, 'USD');
  t.is(entries[2].type, 'credit');
});

test('Can check whether entry is balanced', (t) => {
  const good = new Entry({
    transaction: TX,
    shortcut: '10 eth revenue',
    type: DEBIT,
    
  });
  t.is(good.isBalanced(), false);
  const partner = good.makeBalancingClone({path: 'equity'});
  t.is(good.isBalanced(), false);
  good.setPair(partner, '=');
  t.is(good.pair, partner);
  t.is(good.isBalanced(), true);
  t.is(good.pair.isBalanced(), true);
});

test('same currency, same account is not balanced', (t) => {
  const first = new Entry({
    transaction: TX,
    shortcut: '10 eth',
    type: DEBIT,
    
  });
  t.is(first.isBalanced(), false);
  const partner = first.makeBalancingClone({});
  t.is(first.isBalanced(), false);
  first.setPair(partner, '=');
  t.is(first.pair, partner);
  t.is(first.isBalanced(), false);
  t.is(partner.isBalanced(), false);
});

test('shortcut with tabs', (t) => {
  const tab = '	';
  const e = new Entry({transaction: TX, shortcut: `0.00000370${tab}BTC${tab}Assets:Exchanges:CryptoBridge`});
  t.is(e.account, 'Assets:Exchanges:CryptoBridge');
  t.is(e.quantity.toFixed(8), '0.00000370');
  t.is(e.currency, 'BTC');
});
