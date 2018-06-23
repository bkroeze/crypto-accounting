import fs from 'graceful-fs';

import { loadYamlFromFilenameSync } from './yaml_loader.js';
import Journal from '../models/journal';

export function loadJournalFromFilenameSync(fname) {
  return new Journal(loadYamlFromFilenameSync(fname, ''));
}
