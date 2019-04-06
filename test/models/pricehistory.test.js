import Moment from 'moment';
import test from 'ava';
import PairPrice from '../../src/models/pairprice';
import PriceHistory from '../../src/models/pricehistory';
import * as utils from '../../src/utils/models';
import { ERRORS } from '../../src/models/constants';
import { journalFinder } from '../utils';
import { initDB } from '../../src/loaders/storage';
const getJournalFromYaml = journalFinder(__dirname);

test('Can check for presence of a price on a date for a symbol', async (t) => {
  const entries = [
    '2018-06-16 ETH/USD 600',
    '2018-06-17 BTC/USD 7000',
    '2018-06-17 ETH/USD 650',
    '2018-06-17 GIN/BTC 0.0001',
    '2018-06-18 BTC/USD 6800',
    '2018-06-18 ETH/USD 650',
    '2018-06-18 GIN/BTC 0.00011',
    '2018-06-19 ETH/USD 700',
    '2018-06-20 ETH/USD 650',
  ];
  initDB('test.db', true);
  const prices = await PriceHistory.load(entries, 'test.db');
  t.is(prices.hasDayPrice('ETH', 'USD', '2018-06-16'), 1);
  t.is(prices.hasDayPrice('BTC', 'USD', '2018-06-16'), 0);
  t.is(prices.hasDayPrice('BTC', 'USD', '2018-06-17'), 1);
  t.is(prices.hasDayPrice('ETH', 'USD', '2020-06-16'), 0);
});

test('Can find day prices using translations', async (t) => {
  const prices = [
    '2018-06-17 BTC/USD 7000',
    '2018-06-17 ETH/USD 650',
    '2018-06-17 GIN/BTC 0.0001',
    '2018-06-18 BT    C/USD 6800',
    '2018-06-18 ETH/USD 650',
    '2018-06-18 GIN/BTC 0.00011',
  ];
  initDB('test.db', true);
  const history = await PriceHistory.load(prices, 'test.db');
  history.hasTranslatedDayPrice('GIN', 'USD', '2018-06-17', ['BTC', 'ETH'])
    .orElse(() => t.fail('should have had BTC as translation'))
    .map(xlate => {
      t.is(xlate, 'BTC');
    });
});

test('PriceHistory loads multiple currencies', async (t) => {
  const btc1 = new PairPrice('2018-07-01 BTC/USD 6500');
  const btc2 = new PairPrice('2018-05-11 BTC/USD 7800');
  const eth1 = new PairPrice('2018-05-01 ETH/USD 500');
  initDB('test.db', true);
  const history = await PriceHistory.load([btc1,btc2, eth1], 'test.db');
  t.is(history.hasPair('BTC', 'USD'), 1);
  t.is(history.hasPair('USD', 'BTC'), -1);
  t.is(history.hasPair('ETH', 'USD'), 1);
  t.is(history.hasPair('USD', 'ETH'), -1);
  t.is(history.hasPair('USD/XRP'), 0);
});

test('PriceHistory searches by date', async (t) => {
  const btc1 = new PairPrice('2018-07-01 BTC/USD 6500');
  const btc2 = new PairPrice('2018-05-11 BTC/USD 7800');
  const eth1 = new PairPrice('2018-05-01 ETH/USD 500');
  initDB('test2.db', true);
  const history = await PriceHistory.load([btc1,btc2, eth1], 'test2.db');
  const result = history.findPrice('2018-05-11', 'BTC', 'USD');
  t.deepEqual(result.id, btc2.id);
});

test('Calculates price by inversion if needed', async (t) => {
  const prices = [
    '2018-06-16 ETH/USD 600',
    '2018-06-17 BTC/USD 7000',
    '2018-06-17 ETH/USD 650',
    '2018-06-17 GIN/BTC 0.0001',
    '2018-06-18 BTC/USD 6800',
    '2018-06-18 ETH/USD 650',
    '2018-06-18 GIN/BTC 0.00011',
    '2018-06-19 ETH/USD 700',
    '2018-06-20 ETH/USD 650',
  ];
  initDB('test.db', true);
  const history = await PriceHistory.load(prices, 'test.db');
  const price = history.findPrice('2018-06-17', 'USD', 'ETH');
  t.is(price.rate.toFixed(8), '0.00153846');
  t.is(price.pair, 'USD/ETH');
});

test('Derives price if needed', async (t) => {
  const prices = [
    '2018-06-16 ETH/USD 600',
    '2018-06-17 BTC/USD 7000',
    '2018-06-17 ETH/USD 650',
    '2018-06-17 GIN/BTC 0.0001',
    '2018-06-18 BTC/USD 6800',
    '2018-06-18 ETH/USD 650',
    '2018-06-18 GIN/BTC 0.00011',
    '2018-06-19 ETH/USD 700',
    '2018-06-20 ETH/USD 650',
  ];
  initDB('test.db', true);
  const history = await PriceHistory.load(prices, 'test.db');
  const price = history.findPrice('2018-06-17', 'GIN', 'USD');
  t.is(price.pair, 'GIN/USD');
  t.is(price.rate.toFixed(2), '0.70');
  t.is(price.derived);
});

test('Finds gaps in a list of prices', t => {
  const gaps = PriceHistory.findGaps([
    {utc: '2000-01-01'},
    {utc: '2000-01-02'},
    {utc: '2000-01-04'},
    {utc: '2000-01-10'},
  ]);
  const clean = gaps.map(g => g.toISOString().substring(0,10));
  t.deepEqual(clean, ['2000-01-03', '2000-01-05', '2000-01-06', '2000-01-07', '2000-01-08', '2000-01-09']);
});

test('Finds no missing dates in journal', async (t) => {
  initDB('test_3.db', true);
  const journal = getJournalFromYaml('journal_2.yaml');
  const history = await journal.pricehistory.waitForLoad();
  const missing = history.findMissingDatesInJournal(journal);
  t.true(missing.isEmpty);
});

test('Finds missing dates in journal', async (t) => {
  initDB('test_4.db', true);
  const journal = getJournalFromYaml('journal_3.yaml');
  const history = await journal.pricehistory.waitForLoad();
  const missing = history.findMissingDatesInJournal(journal);
  history.hasTranslatedDayPrice('GIN', 'USD', '2019-06-17', ['BTC'])
    .orElse(() => {t.fail('Should have price')})
    .map(xlate => {t.is(xlate, 'BTC')});

  t.is(history.hasDayPrice('BTC', 'USD', '2019-06-18'), 0);

  // missing.missing.forEach((m, ix) => console.log(`${ix} ---\n${JSON.stringify(m)}`));
  t.false(missing.isEmpty);
  t.is(missing.missing.length, 1);
  const gin = missing.missing[0];
  t.is(gin.pair, 'GIN/USD');
  const june = Moment.utc('2019-06-18');
  t.true(gin.utc.isSame(june));
});
