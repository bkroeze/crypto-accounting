import path from 'path';
import { loadYamlFromFilename } from '../src/loaders/yaml_loader';
import { loadJournalFromFilenameSync } from '../src/loaders/loader';

export function getTestYaml(dirname, fname) {
  return loadYamlFromFilename(path.join(dirname, 'fixtures', fname));
}

export function journalFinder(dirname) {
  return fname => loadJournalFromFilenameSync(fname, path.join(dirname, 'fixtures'));
}
