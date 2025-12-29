import * as console from 'node:console';
import { z } from 'zod/v4';

import { createClient } from '@blaaah/jira-node';

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
  const client = createClient({
    baseUrl: process.env.JIRA_BASE_URL!,
    username: process.env.JIRA_USERNAME!,
    password: process.env.JIRA_PASSWORD!,
  });
  let nextPageToken: string | undefined = undefined;
  do {
    // @ts-ignore
    const { data, response } = await client.GET('/rest/api/3/search/jql', {
      params: {
        query: {
          jql,
          nextPageToken,
          expand: 'changelog',
          fields: ['*all'],
        },
      },
    });
    if (response.status !== 200 || !data) {
      console.log('No response', { status: response.status, data });
      break;
    }
    if (!data.issues) {
      console.log('No issues');
      break;
    }
    console.log(`Got issues: ${data.issues.length}`);

    const results = z.array(IssueSchema).safeParse(data.issues);
    if (!results.success) {
      console.log(`Error parsing issues`, results.error.message);
      break;
    }

    yield results.data;
    nextPageToken = data.nextPageToken;
    if (nextPageToken !== undefined) {
      console.log('Waiting for 100ms.');
      await wait(100);
    }
  } while (nextPageToken !== undefined);
}
