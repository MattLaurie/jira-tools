import 'dotenv/config';
import fs from 'node:fs';
import { Command } from '@commander-js/extra-typings';
import type { Issue } from '@blaaah/jira-node';
import { JiraClient, readJiraConfig } from '@blaaah/jira-node';

const program = new Command();
program.description('nick-scali');
program.version('0.1.0', '-v, --version');

const issues = new Command('issues');

issues.command('search')
  .argument('<jql>', 'the JQL search query')
  .option('-o, --output <file>', 'the output file')
  .description(
    'Search for issues using the given JQL query',
  )
  .action(async (jql, options) => {
    const config = readJiraConfig();
    const client = new JiraClient(config);
    const issues: Issue[] = [];
    for await (const results of client.getIssues(jql)) {
      issues.push(...results);
    }
    const outputFile = options.output ?? `search-${Date.now()}.json`;
    await fs.promises.writeFile(outputFile, JSON.stringify(issues, null, 2), { encoding: 'utf8' });
  });

program.addCommand(issues);

void (async () => {
  await program.parseAsync();
})();