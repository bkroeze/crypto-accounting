import fs from 'graceful-fs';
import * as R from 'ramda';
import path from 'path';
import { safeLoad } from 'js-yaml';

let activeFS = fs;

export function setMockFS(mock) {
  activeFS = mock || fs;
}

export function loadYamlFromFilename(fname) {
  return new Promise(
    (resolve, reject) => {
      activeFS.readFile(fname, (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      }, 'utf-8');
    })
    .then(data => {
      return safeLoad(data);
    })
    .then(loaded => {
      return loadRefs(loaded, path.dirname(fname))
    });
}

export function loadYamlFromFilenameSync(fname) {
  return safeLoad(activeFS.readFileSync(fname, 'utf-8'));
}

export function loadRefs(work, directory) {
  let merged = work;
  findRefs(work).forEach(ref => {
    // and merge in the result of loading the link
    const child = loadRefLink(ref.link, directory);
    merged = R.dissocPath(R.concat(ref.path, ['$ref']), merged);
    merged = R.assocPath(ref.path, child, merged);
  });
  return merged;
}

export function loadRefLink(link, directory) {
  let fname = link;
  if (!(R.startsWith('/', fname) || fname.slice(1,2) === ':')) {
    fname = path.normalize(`${directory}/${fname}`);
  }
  return loadRefs(loadYamlFromFilenameSync(fname), directory);
}

const hasRef = R.has('$ref');
const isObjectByKey = (obj, key) => R.is(Object, R.prop(key, obj));
const objectTester = R.curry(isObjectByKey);

/**
 * Finds the paths for every instance of "$ref" as a key
 * @param {Object} work object to search
 * @param {Array<String>} path existing path to extend
 * @return {Array<Object<Array<String>, String>>} An array of paths, given as {path: array, link: string}
 */
export function findRefs(work, path=[]) {
  let refs = [];

  if (hasRef(work)) {
    refs.push({path, link: work['$ref']});
  }
  const tester = objectTester(work);
  R.filter(tester, R.keysIn(work)).forEach(key => {
    // the key is a key for an object in work
    // so recurse, with the current path
    // adding to refs each time.
    refs = R.concat(refs, findRefs(work[key], R.concat(path, [key])));
  });
  return refs;
}
