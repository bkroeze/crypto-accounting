import test from 'ava';

import { setMockFS } from '../../src/loaders/common';
import * as csv from '../../src/loaders/csv_converter';
import MockFS from '../mockfs';

const header = (currency) => `"Confirmed","Date","Type","Label","Address","Amount (${currency})","ID"`;

const simpleData = [
  '"true","2018-07-11T23:15:57","Masternode Reward","MN1","CLbJSt79vKz7JRQASCeE5jZzkeNo68dMWR","320.00000000","70971385e41478352e0040e95cc50bb6c347a0385b3618cc05b7452544a7bc07"',
  '"true","2018-07-11T01:30:53","Masternode Reward","MN1","CLbJSt79vKz7JRQASCeE5jZzkeNo68dMWR","320.00000000","122f23e635e8fc7d085e4120fc6bd720970c10130a9e73c48e565a896b6f15cb"',
  '"true","2018-07-10T11:08:22","Minted","MN1","CLbJSt79vKz7JRQASCeE5jZzkeNo68dMWR","79.99998520","e90724b3e70852b25824957bf34e80b0b52f1911bf34b1c0564c1fe0266a2f7f"',
  '"true","2018-07-10T09:54:03","Minted","MN1","CLbJSt79vKz7JRQASCeE5jZzkeNo68dMWR","79.99998520","1efd6e15588931ba5f14d1416839d70cc0278214c00c9264961ee3bc5b79f63a"',
];

test('Can parse objects from csv', (t) => {
  const data = [header('TEST')].concat(simpleData).join('\n');
  const result = csv.parseWalletCSV(data, 'TEST', 'assets:test', 'income:crypto');
  t.is(result.length, 4);
  t.is(result[0].id, '70971385e41478352e0040e95cc50bb6c347a0385b3618cc05b7452544a7bc07');
  t.is(result[3].id, '1efd6e15588931ba5f14d1416839d70cc0278214c00c9264961ee3bc5b79f63a');
});

test('Can parse a sample csv export from file', (t) => {
  const data = [header('TEST'), simpleData[0], simpleData[1]].join('\n');
  const mockfs = new MockFS({'test.csv': data});
  setMockFS(mockfs);
  const result = csv.walletCsvToYamlSync('test.csv', 'TEST', 'assets:test', 'income:crypto');
  const expected = `- id: 70971385e41478352e0040e95cc50bb6c347a0385b3618cc05b7452544a7bc07
  account: assets:test
  utc: 2018-07-11T23:15:57
  status: cleared
  party: MN1
  note: Masternode Reward
  address: CLbJSt79vKz7JRQASCeE5jZzkeNo68dMWR
  entries:
    - 320.00000000 income:crypto

- id: 122f23e635e8fc7d085e4120fc6bd720970c10130a9e73c48e565a896b6f15cb
  account: assets:test
  utc: 2018-07-11T01:30:53
  status: cleared
  party: MN1
  note: Masternode Reward
  address: CLbJSt79vKz7JRQASCeE5jZzkeNo68dMWR
  entries:
    - 320.00000000 income:crypto
`;
  t.is(result, expected);
  setMockFS(null);
});

test('Can merge without making dupes', (t) => {
  const allData = [header('TEST')].concat(simpleData).join('\n');
  const firstData = [header('TEST'), simpleData[0], simpleData[1], simpleData[2]].join('\n');
  const lastData = [header('TEST'), simpleData[3], simpleData[2], simpleData[1]].join('\n');
  const all = csv.parseWalletCSV(allData, 'TEST', 'assets:test', 'income:crypto');
  const first = csv.parseWalletCSV(allData, 'TEST', 'assets:test', 'income:crypto');
  const last = csv.parseWalletCSV(allData, 'TEST', 'assets:test', 'income:crypto');
  const merged = csv.mergeTransactionLists(first, last);
  t.deepEqual(all, merged);
  // notice that this means that the merge properly sorted them in date order as well.
  t.is(all.length, 4);
  t.is(merged.length, 4);
});
