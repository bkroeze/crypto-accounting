const { initDB, getDB, getCollection } = require("lokijs-promise");
const R = require('ramda');
const log = require('../utils/logging').get('storage');

let hasInit = false;

function safeInitDB(filename, force) {
  if (!hasInit || force) {
    hasInit = true;
    log.debug({loading: filename});
    initDB(filename);
  }
}

function safeGetDB() {
  if (!hasInit) {
    throw new Error('No DB loaded');
  }
  return getDB();
}

async function ensureCollection(collection, props) {
  if (!hasInit) {
    throw new Error('No DB loaded');
  }
  var db = await safeGetDB();
  if (R.indexOf(R.propEq('collection', collection), db.listCollections()) === -1) {
    log.debug('Adding collection', collection);
    const coll = db.addCollection(collection, props);
    return coll;
  }
  log.debug('returning collection', collection);
  return db.getCollection(collection);
}

/**
 * Performs an upsert.
 * This means performing an update if the record exists, or performing an
 * insert if it doesn't.
 * LokiJS (as at version 1.2.5) lacks this function.
 * TODO: Remove this function when LokiJS has built-in support for upserts.
 * @param {object} collection - The target DB collection.
 * @param {string} idField - The field which contains the record's unique ID.
 * @param {object} record - The record to be upserted.
 * @depends lodash
 */
function upsert(collection, idField, record) {
  var query = {[idField]: record[idField]};
  var existingRecord = collection.findOne(query);
  if (existingRecord) {
    const updatedRecord = {...existingRecord, ...record}
    collection.update(updatedRecord);
  } else {
    collection.insert(record);
  }
}


module.exports = {
  ensureCollection,
  getCollection,
  getDB: safeGetDB,
  initDB: safeInitDB,
  upsert,
};
