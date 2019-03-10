const { safeInitDB, safeGetDB, ensureCollection, upsert } = require('./storage');
const log = require('../utils/logging').get('loaders.priceDB');
const PairPrice = require('../models/pairprice');

async function getPriceCollection(filename) {
  return await ensureCollection('pairprices', {
    unique: ['id'],
    indices: ['pair', 'base', 'quote', 'utc'],
  });
}

async function addPrice(pairprice, collection = null) {
  const prices = collection ? collection : await getPriceCollection();
  upsert(prices, 'id', pairprice.toObject({db: true}));
}

module.exports = {
  addPrice,
  getPriceCollection,
};
