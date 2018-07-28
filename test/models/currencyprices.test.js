import test from 'ava';
import CurrencyPrices from '../../src/models/currencyprices';
import PairPrice from '../../src/models/pairprice';
import * as utils from '../../src/utils/models';
import { ERRORS } from '../../src/models/constants';

test('CurrencyPrices are sorted', (t) => {
  const prices = new CurrencyPrices();
  const price1 = new PairPrice('2018-07-01 BTC/USD 6500');
  const price2 = new PairPrice('2018-05-01 BTC/USD 7500');
  prices.insert(price1);
  prices.insert(price2);
  t.is(prices.get(0), price2);
  t.is(prices.get(1), price1);
});

test('CurrencyPrices renders toObject', (t) => {
  const prices = new CurrencyPrices();
  const price1 = new PairPrice('2018-07-01 BTC/USD 6500');
  const price2 = new PairPrice('2018-05-11 BTC/USD 7800');
  const price3 = new PairPrice('2018-05-01 BTC/USD 7500');
  prices.insert(price1);
  prices.insert(price2);
  prices.insert(price3);
  t.deepEqual(prices.toObject(), utils.arrayToObjects([price3, price2, price1]));
});

test('CurrencyPrices finds nearest date', (t) => {
  const price1 = new PairPrice('2018-01-01T00:00:00.000Z BTC/USD 6500');
  const price2 = new PairPrice('2018-01-01T01:00:00.000Z BTC/USD 7800');
  const price3 = new PairPrice('2018-01-01T05:00:00.000Z BTC/USD 7500');
  const prices = new CurrencyPrices([price1, price2, price3]);
  t.deepEqual(prices.findNearest('2018-01-01T00:20:00.000Z'), price1);
  t.deepEqual(prices.findNearest('2018-01-01T00:31:00.000Z'), price2);
  t.deepEqual(prices.findNearest('2018-01-01T02:31:00.000Z'), price2);
  t.deepEqual(prices.findNearest('2018-01-02'), price3);
  const err = t.throws(() => prices.findNearest('2017-01-01', 1000), RangeError);
  t.is(err.message, ERRORS.OUT_OF_RANGE);
});

