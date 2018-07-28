const fs = require('graceful-fs');

let activeFS = fs;

function setMockFS(mock) {
  activeFS = mock || fs;
}

function getFS() {
  return activeFS;
}

module.exports = {
  getFS,
  setMockFS
};
//# sourceMappingURL=common.js.map
