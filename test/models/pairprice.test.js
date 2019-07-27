import test from 'ava';
import { PairPrice } from '../../src/models/pairprice';
import * as utils from '../../src/utils/models';

test('sorts dates correctly', (t) => {
  const p1 = new PairPrice({utc: '2018-02-02', base: 'ETH', quote: 'USD', rate: '400'});
  const p2 = new PairPrice({utc: '2018-01-02', base: 'ETH', quote: 'USD', rate: '500'});

  const prices = [p1, p2];
  PairPrice.sort(prices);
  t.deepEqual(prices, [p2, p1]);
});

test('sorts by quotes next after utc', (t) => {
  const ethusd1 = new PairPrice({utc: '2018-01-02', base: 'ETH', quote: 'USD', rate: '400'});
  const ethusd2 = new PairPrice({utc: '2018-01-02', base: 'ETH', quote: 'USD', rate: '500'});
  const ethbtc1 = new PairPrice({utc: '2018-01-02', base: 'ETH', quote: 'BTC', rate: '500'});
  const ethxrp1 = new PairPrice({utc: '2018-01-02', base: 'ETH', quote: 'XRP', rate: '1000'});
  const ethxrp2 = new PairPrice({utc: '2018-01-01', base: 'ETH', quote: 'XRP', rate: '1000'});

  const prices = [ethusd1, ethusd2, ethbtc1, ethxrp1, ethxrp2];
  PairPrice.sort(prices);
  t.deepEqual(prices, [ethxrp2, ethbtc1, ethusd1, ethusd2, ethxrp1]);
});

test('sorts by utc, quote, base', (t) => {
  const ethusd1 = new PairPrice({utc: '2018-01-02', base: 'ETH', quote: 'USD', rate: '400'});
  const btcusd1 = new PairPrice({utc: '2018-01-02', base: 'BTC', quote: 'USD', rate: '500'});
  const ethbtc1 = new PairPrice({utc: '2018-01-02', base: 'ETH', quote: 'BTC', rate: '500'});
  const ethxrp1 = new PairPrice({utc: '2018-01-02', base: 'ETH', quote: 'XRP', rate: '1000'});
  const ethxrp2 = new PairPrice({utc: '2018-01-01', base: 'ETH', quote: 'XRP', rate: '1000'});

  const prices = [ethusd1, btcusd1, ethbtc1, ethxrp1, ethxrp2];
  PairPrice.sort(prices);
  t.deepEqual(prices, [ethxrp2, ethbtc1, btcusd1, ethusd1, ethxrp1]);
});

test('loads shortcuts', (t) => {
  const ethusd1 = '2018-01-02 ETH/USD 400';
  const btcusd1 = '2018-01-02 BTC/USD 500';
  const ethbtc1 = '2018-01-02 ETH/BTC 500';
  const ethxrp1 = '2018-01-02 ETH/XRP 1000';
  const ethxrp2 = '2018-01-01 ETH/XRP 1001';

  const prices = [ethusd1, btcusd1, ethbtc1, ethxrp1, ethxrp2].map(p => new PairPrice(p));
  PairPrice.sort(prices);
  const results = prices.map(p => `${p.pair} ${p.rate.toFixed(0)}`)
  t.deepEqual(results, [
    'ETH/XRP 1001',
    'ETH/BTC 500',
    'BTC/USD 500',
    'ETH/USD 400',
    'ETH/XRP 1000',
  ]);
});
