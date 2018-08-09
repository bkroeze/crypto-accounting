const R = require('ramda');

const requireCommands = R.map((cmd) => {
  try {
    return require(`./${cmd}`).command;
  } catch (e) {
    console.log(`Error while loading: ${cmd}`);
    throw e;
  }
});

const commands = requireCommands([
  'convert',
]);

module.exports = commands;
