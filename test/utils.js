import path from 'path';
import { loadYamlFromFilename } from '../src/loaders/yaml_loader';
import { loadJournalFromFilenameSync } from '../src/loaders/loader';

export function getTestYaml(dirname, fname) {
  return loadYamlFromFilename(path.join(dirname, 'fixtures', fname));
}

export const journalFinder = (dirname) => (fname) => {
  return loadJournalFromFilenameSync(fname, path.join(dirname, 'fixtures'));
}
