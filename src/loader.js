import fs from 'graceful-fs';
import Journal from './models/journal';

export async function loadJournalFromFilename(fname) {
  return new Promise(
    (resolve, reject) => {
      fs.readFile(fname, (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      });
    })
    .then(data => {
      return new Journal(data);
    });
}

export function loadJournalFromFilenameSync(fname) {
  return new Journal(fs.readFileSync(fname));
}
