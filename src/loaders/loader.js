/* eslint import/prefer-default-export: off */
import { loadYamlFromFilenameSync } from './yaml_loader';
import Journal from '../models/journal';

export function loadJournalFromFilenameSync(fname, directory) {
  return new Journal(loadYamlFromFilenameSync(fname, directory));
}
