import test from 'ava';
import { safeDump } from 'js-yaml';

import { setMockFS } from '../../src/loaders/common';
import { loadJournalFromFilenameSync } from '../../src/loaders/loader';
import MockFS from '../mockfs';

test('Can load a journal with just a list of accounts', (t) => {
  const work = {
    accounts: {
      testa: {
        note: 'test a',
      },
      testb: {
        note: 'test b',
      },
    },
  };
  const yaml = safeDump(work);
  const mockfs = new MockFS({ 'journal.yaml': yaml });
  setMockFS(mockfs);
  const result = loadJournalFromFilenameSync('journal.yaml');
  t.is(result.accounts.testa.note, 'test a');
  setMockFS(null);
});

test('Can load a journal with just a list accounts including children', (t) => {
  const work = {
    accounts: {
      testa: {
        note: 'test a',
        children: {
          childa: {
            note: 'child a',
          },
        },
      },
    },
  };
  const yaml = safeDump(work);
  const mockfs = new MockFS({ 'journal.yaml': yaml });
  setMockFS(mockfs);
  const result = loadJournalFromFilenameSync('journal.yaml');
  t.is(result.accounts.testa.note, 'test a');
  t.is(result.getAccount('testa').path, 'testa');
  t.is(result.getAccount('testa:childa').note, 'child a');
  setMockFS(null);
});

test('Can load a journal with currencies', (t) => {
  const work = {
    currencies: {
      BTC: {
        name: 'Bitcoin',
      },
      ETH: {
        name: 'Ethereum',
      },
    },
  };
  const yaml = safeDump(work);
  const mockfs = new MockFS({ 'journal.yaml': yaml });
  setMockFS(mockfs);
  const result = loadJournalFromFilenameSync('journal.yaml');
  t.is(result.currencies.ETH.name, 'Ethereum');
  setMockFS(null);
});

test('Can load a journal with transactions', (t) => {
  const work = {
    transactions: [{
      utc: '2018-01-01',
      account: 'test',
      entries: ['100 ETH @ 0.1 BTC'],
    }],
  };
  const yaml = safeDump(work);
  const mockfs = new MockFS({ 'journal.yaml': yaml });
  setMockFS(mockfs);
  const result = loadJournalFromFilenameSync('journal.yaml');
  t.is(result.transactions[0].entries.length, 2);
  t.is(result.transactions[0].size(), 2);
  setMockFS(null);
});

test('Can load a full journal', (t) => {
  const work = {
    accounts: {
      testa: {
        note: 'test a',
      },
      testb: {
        note: 'test b',
      },
    },
    currencies: {
      BTC: {
        name: 'Bitcoin',
      },
      ETH: {
        name: 'Ethereum',
      },
    },
    transactions: [{
      utc: '2018-01-01',
      account: 'testa',
      entries: [
        '100 ETH @ 0.1 BTC',
      ],
    }],
  };
  const yaml = safeDump(work);
  const mockfs = new MockFS({ 'journal.yaml': yaml });
  setMockFS(mockfs);
  const result = loadJournalFromFilenameSync('journal.yaml');
  t.is(result.accounts.testa.note, 'test a');
  t.is(result.currencies.ETH.name, 'Ethereum');
  t.is(result.transactions[0].entries.length, 2);
  t.is(result.transactions[0].size(), 2);
  setMockFS(null);
});
