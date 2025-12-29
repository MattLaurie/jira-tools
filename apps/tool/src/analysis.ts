import 'dotenv/config';

import * as console from 'node:console';
import fs from 'node:fs';
import { Command, InvalidArgumentError } from '@commander-js/extra-typings';
import {
  differenceInBusinessDays,
  differenceInDays,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
} from 'date-fns';
import * as csv from 'fast-csv';

import { getIssues, IssueType } from './utils/issues';

export const analysis = new Command('analysis');

enum TimePeriod {
  Week = 'week',
  Month = 'month',
  Quarter = 'quarter',
}

function parseTimePeriod(input: string): TimePeriod {
  if (Object.values(TimePeriod).includes(input as TimePeriod)) {
    return input as TimePeriod;
  }
  throw new InvalidArgumentError(
    `Allowed values are: ${Object.values(TimePeriod).join(', ')}`
  );
}

function convertTimePeriodJql(period: TimePeriod): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const formatUTC = (date: Date): string => date.toISOString().split('T')[0]!;

  const endDate = formatUTC(now);
  switch (period) {
    case TimePeriod.Week:
      return {
        startDate: formatUTC(startOfWeek(now, { weekStartsOn: 1 })),
        endDate,
      };
    case TimePeriod.Month:
      return {
        startDate: formatUTC(startOfMonth(now)),
        endDate,
      };
    case TimePeriod.Quarter:
      return {
        startDate: formatUTC(startOfQuarter(now)),
        endDate,
      };
  }
}

analysis
  .command('lead-cycle')
  .argument('<project>', 'the Jira project name')
  .argument(
    '[period]',
    `the time period (${Object.values(TimePeriod)
      .map((v) => `"${v}"`)
      .join(', ')})`,
    parseTimePeriod,
    TimePeriod.Quarter
  )
  .option('-o, --output <file>', 'the output file')
  .description(
    'Lead and cycle times for a given project over a given time period'
  )
  .action(async (project, period, options) => {
    const results: IssueType[] = [];
    const stream = csv.format({ headers: true });
    stream.pipe(fs.createWriteStream(`${project}-output.csv`, 'utf-8'));

    const { startDate, endDate } = convertTimePeriodJql(period);

    const where = [
      `project = ${project}`,
      `resolutiondate >= ${startDate}`,
      `resolutiondate <= ${endDate}`,
      `resolution = Done`,
    ];
    const order = `order by resolutiondate DESC`;
    const jql = where.join(' AND ') + ' ' + order;

    console.log('JQL', jql);

    for await (const issues of getIssues(jql)) {
      results.push(...issues);
      for (const issue of issues) {
        if (issue.fields.status.name === 'Cancelled') {
          console.log('Skipping cancelled issue');
          continue;
        }

        const created = issue.fields.created;
        const completed = issue.fields.resolutiondate;
        const inprogress = issue.changelog.histories.find((h) =>
          h.items.find((i) => {
            return (
              i.field === 'status' &&
              i.fromString === 'To Do' &&
              ['Uphill', 'In Progress', 'In Review', 'Done', 'Passed'].includes(
                i.toString ?? ''
              )
            );
          })
        )?.created;

        if (!inprogress) {
          console.log(`Unable to find in progress for ${issue.key}`);
          continue;
        }

        // lead time => creation to resolution
        const leadTimeDays = differenceInDays(completed, created);
        const leadTimeBusinessDays = differenceInBusinessDays(
          completed,
          created
        );

        // cycle time => in-progress to resolution
        const cycleTimeDays = differenceInDays(completed, inprogress);
        const cycleTimeBusinessDays = differenceInBusinessDays(
          completed,
          inprogress
        );

        stream.write({
          project: issue.fields.project.name,
          key: issue.key,
          type: issue.fields.issuetype.name,
          summary: issue.fields.summary,
          assignee: issue.fields.assignee?.displayName ?? 'Unassigned',
          parentKey: issue.fields.parent?.key ?? 'Unknown',
          parentName: issue.fields.parent?.fields.summary ?? 'Unknown',
          created: created.toISOString(),
          createdYearMonth: format(created, 'yyyy-MM'),
          createdYearWeek: format(created, 'yyyy-ww'),
          createdWeekStart: startOfWeek(created, {
            weekStartsOn: 1,
          }).toISOString(),
          completed: completed.toISOString(),
          completedYearMonth: format(completed, 'yyyy-MM'),
          completedYearWeek: format(completed, 'yyyy-ww'),
          completedWeekStart: startOfWeek(completed, {
            weekStartsOn: 1,
          }).toISOString(),
          inprogress: inprogress.toISOString(),
          inprogressYearMonth: format(inprogress, 'yyyy-MM'),
          inprogressYearWeek: format(inprogress, 'yyyy-ww'),
          inprogressWeekStart: startOfWeek(inprogress, {
            weekStartsOn: 1,
          }).toISOString(),
          leadTimeDays,
          leadTimeBusinessDays,
          cycleTimeDays,
          cycleTimeBusinessDays,
        });
      }
    }
    stream.end();

    const outputFile = options.output ?? `${project}-issues-${Date.now()}.json`;
    await fs.promises.writeFile(outputFile, JSON.stringify(results, null, 2), {
      encoding: 'utf8',
    });
  });
