/* eslint import/prefer-default-export: off */
const { loadYamlFromFilenameSync } = require('./yaml_loader');
const Journal = require('../models/journal');

function loadJournalFromFilenameSync(fname, directory) {
  return new Journal(loadYamlFromFilenameSync(fname, directory));
}

module.exports = {
  loadJournalFromFilenameSync
};
//# sourceMappingURL=loader.js.map
