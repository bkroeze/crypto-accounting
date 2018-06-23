yaml = require('js-yaml');
fs   = require('fs');

// Get document, or throw exception on error
try {
  var doc = yaml.safeLoadAll(fs.readFileSync('docs/examples/journal.yaml', 'utf8'));
  console.log(JSON.stringify(doc, null, 2));
} catch (e) {
  console.log(e);
}
