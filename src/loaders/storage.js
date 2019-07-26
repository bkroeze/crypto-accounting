const Loki = require('lokijs')
const R = require('ramda');
const log = require('../utils/logging').get('storage');

let hasInit = false;
let isLoaded = false
let db = null

const initDB = (dbName, autosaveInterval) => {
  db = new Loki(dbName, {
    autoload: true,
    autoloadCallback: () => {
      isLoaded = true
    },
    autosave: true,
    autosaveInterval: autosaveInterval || 1000
  })
}

function getDB () {
  return new Promise((resolve, reject) => {
    try {
      let interval = setInterval(() => {
        if (isLoaded) {
          clearInterval(interval)
          resolve(db)
        }
      }, 100)
    } catch (error) {
      reject(error)
    }
  })
}

function getCollection (collectionName) {
  return new Promise(async (resolve, reject) => {
    try {
      let database = await getDB()
      let collection = database.getCollection(collectionName) ? database.getCollection(collectionName) : database.addCollection(collectionName, { clone: true, disableMeta: true }) // Creates a new DB with `clone = true` so that db records cannot be directly modified from the result-set.
      resolve(collection) // This returns a Promise since this entire function is declared with the async keyword
    } catch (error) {
      reject(error)
    }
  })
}

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
