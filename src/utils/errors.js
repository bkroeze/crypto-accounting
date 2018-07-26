/**
 * Make an enhanced error.
 * @param {Class} ErrClass
 * @param {String} code
 * @param {Any} detail
 */
export function makeError(ErrClass, code, detail) {
  const err = new ErrClass(code);
  err.detail = detail;
  return err;
}

export default {
  makeError,
};
