import Loki from 'lokijs';
import * as R from 'ramda';
import { get as getLogger } from 'js-logger';

const log = getLogger('storage');

let hasInit = false;
let isLoaded = false;
let db = null;

const _initDB = (dbName, autosaveInterval) => {
  db = new Loki(dbName, {
    autoload: true,
    autoloadCallback: () => {
      isLoaded = true;
    },
    autosave: true,
    autosaveInterval: autosaveInterval || 1000,
  });
};

function _getDB() {
  return new Promise((resolve, reject) => {
    try {
      const interval = setInterval(() => {
        if (isLoaded) {
          clearInterval(interval);
          resolve(db);
        }
      }, 100);
    } catch (error) {
      reject(error);
    }
  });
}

export function getCollection(collectionName) {
  return new Promise(async (resolve, reject) => {
    try {
      const database = await _getDB();
      // Creates a new DB with `clone = true` so that db records cannot be directly modified from the result-set.
      const collection = database.getCollection(collectionName) ? database.getCollection(collectionName) : database.addCollection(collectionName, { clone: true, disableMeta: true });
      resolve(collection); // This returns a Promise since this entire function is declared with the async keyword
    } catch (error) {
      reject(error);
    }
  });
}

export function initDB(filename, force) {
  if (!hasInit || force) {
    hasInit = true;
    log.debug({ loading: filename });
    _initDB(filename);
  }
}

export function getDB() {
  if (!hasInit) {
    throw new Error('No DB loaded');
  }
  return _getDB();
}

export async function ensureCollection(collection, props) {
  if (!hasInit) {
    throw new Error('No DB loaded');
  }
  const data = await getDB();
  if (R.indexOf(R.propEq('collection', collection), data.listCollections()) === -1) {
    log.debug('Adding collection', collection);
    const coll = data.addCollection(collection, props);
    return coll;
  }
  log.debug('returning collection', collection);
  return data.getCollection(collection);
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
export function upsert(collection, idField, record) {
  const query = { [idField]: record[idField] };
  const existingRecord = collection.findOne(query);
  if (existingRecord) {
    const updatedRecord = { ...existingRecord, ...record };
    collection.update(updatedRecord);
  } else {
    collection.insert(record);
  }
}
