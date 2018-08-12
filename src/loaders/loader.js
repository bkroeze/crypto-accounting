/* eslint import/prefer-default-export: off */
const { loadYamlFromFilenameSync } = require('./yaml_loader');
const { makeError } = require('../utils/errors');
const { ERRORS } = require('../models/constants');
const Journal = require('../models/journal');
const path = require('path');

function loadJournalFromFilenameSync(fname, directory = null) {
  if (!fname) {
    throw makeError(ERRORS.MISSING_PARAMETER, 'Missing filename');
  }
  let cleanFname = fname;
  let cleanDir = directory;
  if (directory === null) {
    const parsed = path.parse(fname);
    cleanFname = parsed.base;
    cleanDir = parsed.dir;
  }
  console.log(`loading ${cleanDir}/${cleanFname}`);
  const data = loadYamlFromFilenameSync(cleanFname, cleanDir);
  console.log('got data');
  const journal = new Journal(data);
  console.log('Got journal');
  return journal;
}

module.exports = {
  loadJournalFromFilenameSync,
};
