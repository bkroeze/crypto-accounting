/* eslint no-underscore-dangle: off */
import * as R from 'ramda';
import * as RA from 'ramda-adjunct';

export function getAccountAliasMap(accounts) {
  let aliases = {};
  const accountPaths = getAccountPathMap(accounts);

  R.valuesIn(accountPaths).forEach((account) => {
    if (account.aliases) {
      account.aliases.forEach(a => {
        aliases[a] = account;
      });
    }
  });
  return aliases;
}

/**
 * Get all accounts, keyed by full path
 * @param {Object<String, Account>} accounts
 * @return {Object<String, Account>} map
 */
export function getAccountPathMap(accounts) {
  let pathMap = {};

  R.valuesIn(accounts).forEach((account) => {
    pathMap[account.path] = account;
    if (!R.isEmpty(account.children)) {
      pathMap = R.merge(pathMap, getAccountPathMap(account.children));
    }
  });
  return pathMap;
}

/**
 * Get an account by following the key path, splitting on colons.
 * @param {Object<String, Account>} accounts
 * @param {String} key such as "assets:banks"
 * @return {Account} account
 * @throws {ReferenceError} if account not found
 */
export function getAccount(accounts, key) {
  let account;
  let path = key;
  if (isString(path)) {
    path = path.split(':');
  }
  account = accounts[path.shift()];
  if (path.length) {
    account = account.getAccount(path);
  }
  if (!account) {
    throw new ReferenceError(`Account Not Found: ${key}`);
  }
  return account;
}


/**
 * Returns a copy of an object, with all members having falsy values removed,
 * except for those in the `butNot` list.
 * @param {object} toStrip
 * @param {array} (optional) list of keys to retain even if falsy
 * @return {object} stripped copy
 */
export function stripFalsyExcept(toStrip, butNot = []) {
  const stripped = {};

  Object.keys(toStrip).forEach((key) => {
    const val = toStrip[key];
    if (R.indexOf(key, butNot) > -1 || (val && RA.isNotEmpty(val))) {
      stripped[key] = val;
    }
  });
  return stripped;
}

/**
 * Simple helper for classes with "toObject" functions
 * @param {Object} work
 * @return {Object} work.toObject() results;
 */
export function toObject(work) {
  return work.toObject();
}

export function objectValsToObject(obj) {
  const work = {};
  R.keysIn(obj).forEach((key) => {
    work[key] = obj[key].toObject();
  });
  return work;
}

export const filterEmpty = R.filter(R.complement(R.isEmpty));
export const isString = R.is(String);
export const isObject = R.is(Object);
export const mapTrim = R.map(R.trim);
export const splitSpace = R.split(' ');
export const numberRe = new RegExp(/^-?[0-9.]+$/);
export const looksNumeric = val => val.search(numberRe) > -1;
export const startsWithCarat = R.startsWith('^');
export const isConnector = R.contains(R.__, ['@', '=']);

export function splitAndTrim(work) {
  return filterEmpty(mapTrim(splitSpace(work)));
}
