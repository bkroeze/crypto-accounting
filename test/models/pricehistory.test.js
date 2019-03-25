import test from 'ava';
import PairPrice from '../../src/models/pairprice';
import PriceHistory from '../../src/models/pricehistory';
import * as utils from '../../src/utils/models';
import { ERRORS } from '../../src/models/constants';

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
    '2018-06-18 BTC/USD 6800',
    '2018-06-18 ETH/USD 650',
    '2018-06-18 GIN/BTC 0.00011',
  ];
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

  const clean = gaps.map(g => g.format('YYYY-MM-DD'));
  t.deepEqual(clean, ['2000-01-03', '2000-01-05', '2000-01-06', '2000-01-07', '2000-01-08', '2000-01-09']);
});
