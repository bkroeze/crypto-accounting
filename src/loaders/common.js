import fs from 'graceful-fs';
let activeFS = fs;

export function setMockFS(mock) {
  activeFS = mock || fs;
}

export function getFS() {
  return activeFS;
}
