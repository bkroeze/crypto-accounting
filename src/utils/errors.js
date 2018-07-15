/**
 * Make an enhanced error.
 * @param {Class} errClass
 * @param {String} code
 * @param {Any} detail
 */
export function makeError(errClass, code, detail) {
  const err = new errClass(code);
  err.detail = detail;
  return err;
}
