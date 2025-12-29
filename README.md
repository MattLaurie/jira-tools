# Jira tools

## Configuration

```shell
cp .env.example .env
```

The following environment variables need to be set:

| Environment Variable | Example                        |
|----------------------|--------------------------------|
| JIRA_BASE_URL        | https://yoursite.atlassian.net | 
| JIRA_USERNAME        | Jira user name                 |
| JIRA_PASSWORD        | Jira personal access token [1] |

[1] See https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html

## Build

```shell
corepack install
pnpm install

pnpm build
```

## Examples

```shell
node apps/tool analysis lead-cycle -h                                                                                                             mainvia  v22.21.1 took 3s
Usage: tool analysis lead-cycle [options] <project> [period]

Lead and cycle times for a given project over a given time period

Arguments:
  project              the Jira project name
  period               the time period ("week", "month", "quarter") (default: "quarter")

Options:
  -o, --output <file>  the output file
  -h, --help           display help for command
``` 

```shell
node apps/tool analysis lead-cycle EXPL quarter
```

## Thanks

Using https://github.com/t3-oss/create-t3-turbo as a starting point.