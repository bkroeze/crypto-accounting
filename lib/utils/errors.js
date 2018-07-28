/**
 * Make an enhanced error.
 * @param {Class} ErrClass
 * @param {String} code
 * @param {Any} detail
 */
function makeError(ErrClass, code, detail) {
  const err = new ErrClass(code);
  err.detail = detail;
  return err;
}

module.exports = {
  makeError
};
//# sourceMappingURL=errors.js.map
