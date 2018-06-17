yaml = require('js-yaml');
fs   = require('fs');

// Get document, or throw exception on error
try {
  var doc = yaml.safeLoad(fs.readFileSync('docs/examples/transactions.yaml', 'utf8'));
  console.log(JSON.stringify(doc, null, 2));
} catch (e) {
  console.log(e);
}
