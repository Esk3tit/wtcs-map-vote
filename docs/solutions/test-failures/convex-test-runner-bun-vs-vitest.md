---
title: "Convex Unit Tests Must Use Vitest, Not Bun's Test Runner"
category: test-failures
tags: [convex, vitest, bun, test-runner, convex-test]
date_solved: 2026-01-22
component: convex
severity: low
---

# Convex Unit Tests Must Use Vitest, Not Bun's Test Runner

## Problem

Running Convex unit tests with `bun test` or `bunx vitest` without the `run` flag fails with errors related to `import.meta.glob` or other Vite-specific features that Bun's built-in test runner does not support.

### Symptom

```bash
bun test convex/sessions.test.ts
# Fails with import.meta.glob errors or other incompatibilities
```

## Root Cause

This project uses `convex-test` which depends on Vitest's environment and plugin system. Bun has its own built-in test runner (`bun test`) that is **not compatible** with:

- Vitest's `environment` configuration
- `import.meta.glob` usage in Convex's generated code
- The `convex-test` library's test harness which expects Vitest APIs

## Solution

Always use the project's configured test script:

```bash
# Correct - uses vitest via the project's package.json script
bun run test

# Also correct - explicit vitest invocation
bunx vitest run

# Run a specific test file
bunx vitest run convex/sessions.test.ts

# Watch mode
bunx vitest
```

### What NOT to use

```bash
# WRONG - uses Bun's built-in test runner, incompatible with convex-test
bun test
bun test convex/sessions.test.ts
```

## Why This Matters

- `bun test` invokes Bun's native test runner which uses a different API and environment than Vitest
- `bun run test` invokes the `test` script from `package.json`, which is configured to use Vitest
- `convex-test` relies on Vitest's `defineConfig` environment settings to properly mock Convex's runtime

## Prevention

- Always use `bun run test` or `bunx vitest run` for running tests
- The `package.json` `test` script is the source of truth for how tests should be run
- CI uses `bun run test:coverage` which also invokes Vitest correctly
