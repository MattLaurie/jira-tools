import fs from 'node:fs';

import type { Issue } from './client';
import { JiraClient } from './client';
import { readJiraConfig } from './config';

const config = readJiraConfig();
const client = new JiraClient(config);

const jql = 'project = "EXPL" AND parent IN ("EXPL-7913", "EXPL-7914", "EXPL-7915", "EXPL-7917") ORDER BY created DESC';

const results: Issue[] = [];
for await (const issues of client.getIssues(jql)) {
  console.log(JSON.stringify(issues.length, null, 2));
  results.push(...issues);
}
await fs.promises.writeFile(`issues-${Date.now()}.json`, JSON.stringify(results, null, 2), { encoding: 'utf8' });