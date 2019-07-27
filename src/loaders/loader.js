/* eslint import/prefer-default-export: off */
import path from 'path';
import { loadYamlFromFilenameSync } from './yaml_loader';
import { makeError } from '../utils/errors';
import { ERRORS } from '../models/constants';
import { Journal } from '../models/journal';

export function loadJournalFromFilenameSync(fname, directory = null) {
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
  const data = loadYamlFromFilenameSync(cleanFname, cleanDir);
  const journal = new Journal(data);
  return journal;
}
