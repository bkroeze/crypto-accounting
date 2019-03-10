import test from 'ava';
import PairPrice from '../../src/models/pairprice';
import PriceHistory from '../../src/models/pricehistory';
import * as utils from '../../src/utils/models';
import { ERRORS } from '../../src/models/constants';

test('PriceHistory loads multiple currencies', async (t) => {
  const btc1 = new PairPrice('2018-07-01 BTC/USD 6500');
  const btc2 = new PairPrice('2018-05-11 BTC/USD 7800');
  const eth1 = new PairPrice('2018-05-01 ETH/USD 500');
  PriceHistory.load([btc1,btc2, eth1], 'test.db')
    .then(history => {
      t.is(history.hasPair('BTC', 'USD'), 1);
      t.is(history.hasPair('USD', 'BTC'), -1);
      t.is(history.hasPair('ETH', 'USD'), 1);
      t.is(history.hasPair('USD', 'ETH'), -1);
      t.is(history.hasPair('USD/XRP'), 0);
      t.done();
    });
});

test('PriceHistory searches by date', async (t) => {
  const btc1 = new PairPrice('2018-07-01 BTC/USD 6500');
  const btc2 = new PairPrice('2018-05-11 BTC/USD 7800');
  const eth1 = new PairPrice('2018-05-01 ETH/USD 500');
  PriceHistory.load([btc1,btc2, eth1], 'test.db')
    .then(history => {
      const result = history.findPrice('2018-05-11', 'BTC', 'USD');
      t.deepEqual(result, btc2);

      const near = history.findPrice('2018-05-08', 'BTC', 'USD');
      t.deepEqual(near, btc2);
      t.done();
    })
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
  PriceHistory.load(prices, 'test.db')
    .then(history => {
      const price = history.findPrice('2018-06-17', 'USD', 'ETH');
      t.is(price.pair, 'USD/ETH');
      t.is(price.rate.toFixed(8), '0.00153846')
      t.done();
    });
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
  PriceHistory.load(prices, 'test.db')
    .then(history => {
      const price = history.findPrice('2018-06-17', 'GIN', 'USD');
      t.is(price.pair, 'GIN/USD');
      t.is(price.rate.toFixed(2), '0.70');
      t.is(price.derived);
      t.done();
    });
});
