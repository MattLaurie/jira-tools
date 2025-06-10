import type { ZodType } from 'zod/v4';
import { z } from 'zod/v4';
import * as process from 'node:process';

export interface JiraConfig {
  enabled: boolean;
  baseUrl: string;
  username: string;
  password: string;
}

export const JiraConfigSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string(),
  username: z.string(),
  password: z.string(),
}) satisfies ZodType<JiraConfig>;

export function readJiraConfig(): JiraConfig {
  if (!process.env.JIRA_USERNAME) {
    throw new Error('Missing JIRA_USERNAME');
  }
  if (!process.env.JIRA_PASSWORD) {
    throw new Error('Missing JIRA_PASSWORD');
  }
  if (!process.env.JIRA_BASE_URL) {
    throw new Error('Missing JIRA_BASE_URL');
  }
  return {
    enabled: false,
    baseUrl: process.env.JIRA_BASE_URL,
    username: process.env.JIRA_USERNAME,
    password: process.env.JIRA_PASSWORD,
  };
}