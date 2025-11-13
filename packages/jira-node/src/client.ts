import type { components, operations, paths } from './schema';
import type { JiraConfig } from './config';
import createClient from 'openapi-fetch';

export type SearchQuery = operations['searchAndReconsileIssuesUsingJql']['parameters']['query'];
export type SearchResults = components['schemas']['SearchResults'];
export type Issue = components['schemas']['IssueBean'];

export class JiraClient {

  constructor(private config: JiraConfig) {
  }

  getClient(config: JiraConfig) {
    return createClient<paths>({
      baseUrl: config.baseUrl,
      headers: {
        Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
      },
    });
  }

  async* getIssues(jql: string): AsyncGenerator<Issue[]> {
    const client = this.getClient(this.config);
    const query: SearchQuery = {
      jql,
      expand: 'changelog',
      fields: ['*all']
    };
    const more = true;
    while (more) {
      const { data, response } = await client.GET('/rest/api/3/search/jql', {
        params: {
          query,
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
      yield data.issues;

      const { nextPageToken, isLast } = data;
      if (!nextPageToken || isLast) {
        break;
      }

      query.nextPageToken = nextPageToken;

      console.log('Waiting for 100ms.');
      await this.sleep(100);
    }
  }

  async sleep(timeout: number) {
    let timeoutId: NodeJS.Timeout | null;
    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        resolve(null);
      }, timeout);
    }).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }
}