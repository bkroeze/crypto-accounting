import * as R from 'ramda';

const requireCommands = R.map((cmd) => {
  try {
    return require(`./${cmd}`).command;
  } catch (e) {
    console.log(`Error while loading: ${cmd}`);
    throw e;
  }
});

export const commands = requireCommands([
  'convert',
  'prices',
  'loadprices',
]);
