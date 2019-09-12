import { ensureCollection, upsert } from './storage';

export async function getPriceCollection() {
  return ensureCollection('pairprices', {
    unique: ['id'],
    indices: ['pair', 'base', 'quote', 'utc'],
  });
}

export async function addPrice(pairprice, collection = null) {
  const prices = collection || await getPriceCollection();
  const record = pairprice.toObject({ db: true });
  upsert(prices, 'id', record);
}
