import 'dotenv/config';

import { Command } from '@commander-js/extra-typings';

import { analysis } from './analysis';

const program = new Command();
program.description('Jira Tools');
program.version('0.1.0', '-v, --version');

program.addCommand(analysis);

void (async () => {
  await program.parseAsync();
})();
