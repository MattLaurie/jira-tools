import 'dotenv/config';

import { Command } from '@commander-js/extra-typings';

import { analysis } from './analysis';
import logger from './logger';

const program = new Command();
program
  .name('jira-tools')
  .description('Jira Tools')
  .version('0.1.0', '--version')
  .option('-v, --verbose', 'Show verbose debug logs')
  .option('-q, --quiet', 'Show only error logs')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      logger.level = 'debug';
    }
    if (opts.quiet) {
      logger.level = 'error';
    }
  });

program.addCommand(analysis);

void (async () => {
  await program.parseAsync();
})();
