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

Find all tickets in `EXPL` project with epic of `EXPL-7913`:

```shell
node apps/tool issues search 'project = "EXPL" AND parent IN ("EXPL-7913") ORDER BY created DESC'
```

## Thanks

Using https://github.com/t3-oss/create-t3-turbo as a starting point.