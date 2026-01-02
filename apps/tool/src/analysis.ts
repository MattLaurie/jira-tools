import 'dotenv/config';

import fs from 'node:fs';
import { Command, InvalidArgumentError } from '@commander-js/extra-typings';
import {
  differenceInBusinessDays,
  differenceInDays,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subQuarters,
  subYears,
} from 'date-fns';
import * as csv from 'fast-csv';

import type { IssueType } from './utils/issues';
import logger from './logger';
import { getIssues } from './utils/issues';

export const analysis = new Command('analysis');

enum TimePeriod {
  CurrentWeek = 'current-week',
  CurrentMonth = 'current-month',
  CurrentQuarter = 'current-quarter',
  PreviousQuarter = 'previous-quarter',
  CurrentYear = 'current-year',
  PreviousYear = 'previous-year',
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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const formatUTC = (date: Date): string => date.toISOString().split('T')[0]!;

  switch (period) {
    case TimePeriod.CurrentWeek:
      return {
        startDate: formatUTC(startOfWeek(now, { weekStartsOn: 1 })),
        endDate: formatUTC(now),
      };
    case TimePeriod.CurrentMonth:
      return {
        startDate: formatUTC(startOfMonth(now)),
        endDate: formatUTC(now),
      };
    case TimePeriod.CurrentQuarter:
      return {
        startDate: formatUTC(startOfQuarter(now)),
        endDate: formatUTC(now),
      };
    case TimePeriod.PreviousQuarter: {
      const lastQuarter = subQuarters(now, 1);
      return {
        startDate: formatUTC(startOfQuarter(lastQuarter)),
        endDate: formatUTC(endOfQuarter(lastQuarter)),
      };
    }
    case TimePeriod.CurrentYear:
      return {
        startDate: formatUTC(startOfYear(now)),
        endDate: formatUTC(now),
      };
    case TimePeriod.PreviousYear: {
      const lastYear = subYears(now, 1);
      return {
        startDate: formatUTC(startOfYear(lastYear)),
        endDate: formatUTC(endOfYear(lastYear)),
      };
    }
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
    TimePeriod.CurrentQuarter
  )
  .option('-o, --output <file>', 'the output file')
  .description(
    'Lead and cycle times for a given project over a given time period'
  )
  .action(async (project, period, options) => {
    const results: IssueType[] = [];

    const stream = csv.format({ headers: true });

    if (options.output) {
      const timestamp = Date.now();
      const outputFileCsv =
        options.output ?? `${project}-${period}-${timestamp}.csv`;
      // TODO check paths, prevent overrwite
      logger.info(`Writing output to "${outputFileCsv}"`);
      stream.pipe(fs.createWriteStream(outputFileCsv, 'utf-8'));
    } else {
      stream.pipe(process.stdout);
    }

    const { startDate, endDate } = convertTimePeriodJql(period);

    const where = [
      `project = ${project}`,
      `resolutiondate >= ${startDate}`,
      `resolutiondate <= ${endDate}`,
      `resolution = Done`,
    ];
    const order = `order by resolutiondate DESC`;
    const jql = where.join(' AND ') + ' ' + order;

    logger.debug(`JQL: "${jql}"`);

    for await (const issues of getIssues(jql)) {
      results.push(...issues);
      for (const issue of issues) {
        if (['Epic', 'Subtask'].includes(issue.fields.issuetype.name)) {
          logger.debug(`Skipping "${issue.fields.issuetype.name}" issue`);
          continue;
        }

        if (issue.fields.status.name === 'Cancelled') {
          logger.debug('Skipping cancelled issue');
          continue;
        }

        const created = issue.fields.created;
        const completed = issue.fields.resolutiondate;
        const inprogress = issue.changelog.histories.find((h) =>
          h.items
            .filter((item) => item.field === 'status')
            .find((i) => {
              const newTicket =
                i.fromString === 'To Do' &&
                [
                  'Uphill',
                  'In Progress',
                  'Dev', // BAD
                  'In Review', // BAD
                  'Merged', // BAD
                  'Done', // BAD
                  'Passed', // BAD
                  'Testing', // BAD
                ].includes(i.toString ?? '');
              const reopened =
                i.fromString === 'CANCELLED' &&
                [
                  'To Do',
                  'Uphill',
                  'In Progress',
                  'Dev', // BAD
                  'In Review', // BAD
                  'Merged', // BAD
                  'Done', // BAD
                  'Passed', // BAD
                  'Testing', // BAD
                ].includes(i.toString ?? '');
              return newTicket || reopened;
            })
        )?.created;

        if (!inprogress) {
          logger.debug(`Unable to find in progress for ${issue.key}`);
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

        logger.debug(`Writing issue ${issue.key}`);

        stream.write({
          project: issue.fields.project.name,
          key: issue.key,
          type: issue.fields.issuetype.name,
          summary: issue.fields.summary,
          assignee: issue.fields.assignee?.displayName ?? 'Unassigned',
          parent_key: issue.fields.parent?.key ?? 'Unknown',
          parent_name: issue.fields.parent?.fields.summary ?? 'Unknown',
          created: created.toISOString(),
          created_year_month: format(created, 'yyyy-MM'),
          created_year_week: format(created, 'yyyy-ww'),
          created_week_start: startOfWeek(created, {
            weekStartsOn: 1,
          }).toISOString(),
          completed: completed.toISOString(),
          completed_year_month: format(completed, 'yyyy-MM'),
          completed_year_week: format(completed, 'yyyy-ww'),
          completed_week_start: startOfWeek(completed, {
            weekStartsOn: 1,
          }).toISOString(),
          inprogress: inprogress.toISOString(),
          inprogress_year_month: format(inprogress, 'yyyy-MM'),
          inprogress_year_week: format(inprogress, 'yyyy-ww'),
          inprogress_week_start: startOfWeek(inprogress, {
            weekStartsOn: 1,
          }).toISOString(),
          lead_time_days: leadTimeDays,
          lead_time_business_days: leadTimeBusinessDays,
          cycle_time_days: cycleTimeDays,
          cycle_time_business_days: cycleTimeBusinessDays,
        });
      }
    }
    stream.end();
  });
