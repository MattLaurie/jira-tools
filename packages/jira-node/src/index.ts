import createFetchClient from 'openapi-fetch';

import type { paths } from './gen/schema.d.ts';

export type * from './gen/schema.d.ts';

export const createClient = ({
  baseUrl,
  username,
  password,
}: {
  baseUrl: string;
  username: string;
  password: string;
}) => {
  return createFetchClient<paths>({
    baseUrl,
    headers: {
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    },
  });
};
