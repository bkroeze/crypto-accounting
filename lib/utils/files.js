const R = require('ramda');

function isRelativePath(fname) {
  return !R.startsWith('/', fname) && fname.slice(1, 2) !== ':';
}

module.exports = {
  isRelativePath
};
//# sourceMappingURL=files.js.map
