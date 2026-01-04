import { z } from 'zod/v4';

import { Jira } from '@blaaah/jira';

import logger from '../logger';

async function wait(milliseconds: number) {
  let timeoutId: NodeJS.Timeout | null;
  return new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      timeoutId = null;
      resolve(null);
    }, milliseconds);
  }).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export const IssueSchema = z.object({
  key: z.string(),
  changelog: z.object({
    histories: z.array(
      z.object({
        id: z.string(),
        author: z.object({
          displayName: z.string(),
        }),
        created: z.coerce.date(),
        items: z.array(
          z.object({
            field: z.string(),
            fieldtype: z.string(),
            fieldId: z.string().nullish(),
            from: z.string().nullish(),
            fromString: z.string().nullish(),
            to: z.string().nullish(),
            toString: z.string().nullish(),
          })
        ),
      })
    ),
  }),
  fields: z.object({
    issuetype: z.object({
      name: z.string(),
    }),
    project: z.object({
      key: z.string(),
      name: z.string(),
    }),
    parent: z
      .object({
        key: z.string(),
        fields: z.object({
          summary: z.string(),
        }),
      })
      .optional(),
    assignee: z
      .object({
        displayName: z.string(),
      })
      .nullable(),
    resolution: z.object({
      name: z.string(),
    }),
    resolutiondate: z.coerce.date(),
    created: z.coerce.date(),
    status: z.object({
      name: z.string(),
      statusCategory: z.object({
        key: z.string(),
        name: z.string(),
      }),
    }),
    summary: z.string(),
  }),
});

export type IssueType = z.infer<typeof IssueSchema>;

export async function* getIssues(jql: string): AsyncGenerator<IssueType[]> {
  const client = new Jira({
    baseUrl: process.env.JIRA_BASE_URL!,
    headers: {
      Authorization: `Basic ${btoa(`${process.env.JIRA_USERNAME!}:${process.env.JIRA_PASSWORD!}`)}`,
    },
  });
  let nextPageToken: string | undefined = undefined;
  do {
    const { data, response } = await client.searchAndReconsileIssuesUsingJql({
      query: {
        jql,
        nextPageToken,
        expand: 'changelog',
        fields: ['*all'],
      },
    });
    if (response.status !== 200 || !data) {
      logger.error('No response', { status: response.status, data });
      break;
    }
    if (!data.issues) {
      logger.debug('No issues');
      break;
    }
    logger.debug(`Got issues: ${data.issues.length}`);

    for (const issue of data.issues) {
      if (
        issue.changelog?.total !== undefined &&
        issue.changelog.maxResults !== undefined &&
        issue.changelog.total > issue.changelog.maxResults
      ) {
        logger.debug(
          `Issue ${issue.key} has more than ${issue.changelog.maxResults} changelog entries, pulling remainder`
        );

        let nextChangelogPageToken: string | undefined = undefined;

        // Clear out the current changes because Jira API is weird.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        issue.changelog.histories!.length = 0;
        do {
          const { data } = await client.getChangeLogs({
            query: {},
            path: {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              issueIdOrKey: issue.key!,
            },
          });
          if (!data?.values) {
            break;
          }
          issue.changelog.histories?.push(...data.values);
          nextChangelogPageToken = data.nextPage;
        } while (nextChangelogPageToken !== undefined);
      }
    }

    const results = z.array(IssueSchema).safeParse(data.issues);
    if (!results.success) {
      logger.error(`Error parsing issues`, results.error.message);
      break;
    }

    yield results.data;
    nextPageToken = data.nextPageToken;
    if (nextPageToken !== undefined) {
      logger.debug('Waiting for 100ms.');
      await wait(100);
    }
  } while (nextPageToken !== undefined);
}
