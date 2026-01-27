---
title: GitHub GraphQL API Queries with gh CLI
category: integration-issues
tags: [github, graphql, gh-cli, api, automation]
created: 2026-01-27
problem_type: api_integration
severity: minor
components: [gh-cli, github-api]
---

# GitHub GraphQL API Queries with gh CLI

## Problem

GraphQL queries via `gh api graphql` frequently fail with cryptic errors like:

```
gh: Expected VAR_SIGN, actual: UNKNOWN_CHAR ("") at [1, 23]
```

This happens when using parameterized queries with variables.

## Root Cause

The `gh api graphql` command has issues parsing variable definitions in certain query formats, especially:
1. Anonymous queries with inline variable definitions
2. Multi-line queries with certain whitespace patterns
3. Variable interpolation with `-f` and `-F` flags

## Working Patterns

### Pattern 1: Named Mutations (RECOMMENDED)

For mutations, always use a named mutation:

```bash
# CORRECT - Named mutation
gh api graphql -f query='
mutation ResolveThread($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
    thread { isResolved }
  }
}' -f threadId="PRRT_kwDOQsgJKs5rTCcq"
```

```bash
# WRONG - Anonymous mutation
gh api graphql -f query='mutation($threadId: ID!) { ... }' -f threadId="..."
```

### Pattern 2: Hardcoded Values for Queries

For read-only queries where you don't need variable reuse, hardcode values:

```bash
# CORRECT - Hardcoded values in query
gh api graphql -f query='query {
  repository(owner: "Esk3tit", name: "wtcs-map-vote") {
    pullRequest(number: 44) {
      reviewThreads(first: 100) {
        nodes { id isResolved path line }
      }
    }
  }
}'
```

### Pattern 3: Single-Line Queries

If you must use variables, keep the query on one line:

```bash
# Works - Single line with named query
gh api graphql -f query='query GetPR($owner: String!, $repo: String!, $pr: Int!) { repository(owner: $owner, name: $repo) { pullRequest(number: $pr) { title } } }' -f owner='Esk3tit' -f repo='wtcs-map-vote' -F pr=44
```

### Pattern 4: Pipe to jq for Filtering

Always pipe to `jq` for complex filtering rather than trying to do it in GraphQL:

```bash
gh api graphql -f query='query { ... }' | jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

## Variable Flag Reference

| Flag | Type | Example |
|------|------|---------|
| `-f` | String | `-f owner='Esk3tit'` |
| `-F` | Integer/JSON | `-F pr=44` |

**Important:** Use `-F` (capital) for integers, `-f` (lowercase) for strings.

## Common Errors and Fixes

### Error: `Expected VAR_SIGN, actual: UNKNOWN_CHAR`

**Cause:** Variable definition syntax issue
**Fix:** Use named query/mutation or hardcode values

### Error: `Cannot iterate over null`

**Cause:** Query returned null (usually from failed variable substitution)
**Fix:** Check query succeeded before piping to jq, or use `jq -e` for error handling

## REST API Alternative

For simpler operations, use the REST API instead:

```bash
# Get PR review comments (REST is simpler here)
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments --jq '.[].body'

# Reply to a comment
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments \
  -f body='Reply text' \
  -F in_reply_to=COMMENT_ID
```

## Quick Reference

```bash
# Resolve a review thread (mutation - must be named)
gh api graphql -f query='
mutation ResolveThread($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
    thread { isResolved }
  }
}' -f threadId="THREAD_ID"

# Get unresolved threads (query - hardcode values)
gh api graphql -f query='query {
  repository(owner: "OWNER", name: "REPO") {
    pullRequest(number: PR_NUM) {
      reviewThreads(first: 100) {
        nodes { id isResolved path }
      }
    }
  }
}' | jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

## Prevention

1. Always use named mutations: `mutation MyMutation($var: Type!)`
2. For queries, prefer hardcoded values over variables
3. Use REST API for simple CRUD operations
4. Test queries in GitHub's GraphQL Explorer first: https://docs.github.com/en/graphql/overview/explorer
