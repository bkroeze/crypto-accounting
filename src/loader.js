import fs from 'graceful-fs';
import { safeLoad } from 'js-yaml';

import Journal from './models/journal';

export async function loadJournalFromFilename(fname) {
  return new Promise(
    (resolve, reject) => {
      fs.readFile(fname, (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      }, 'utf-8');
    })
    .then(data => {
      const yaml = safeLoad(data);
      return new Journal(data);
    });
}

export function loadJournalFromFilenameSync(fname) {
  return new Journal(safeLoad(fs.readFileSync(fname, 'utf-8')));
}
