# TypeScript Errors in convex/ Not Caught by Local Build

---
title: TypeScript errors in convex/ not caught by local build
category: build-errors
tags: [typescript, vitest, convex, ci, netlify, typecheck]
date_solved: 2026-01-19
components: [convex/audit.test.ts, convex/tsconfig.json, .github/workflows]
symptoms: [Netlify deployment fails with TS2345, local build passes, test runs locally without errors]
root_cause: Separate tsconfig for convex folder not included in bun run build typecheck
---

## Problem

Netlify deployment failed with a TypeScript error in `convex/audit.test.ts`:

```
error TS2345: Argument of type '([action]: [AuditAction, string]) => Promise<void>' is not assignable to parameter of type '(args_0: AuditAction, args_1: string) => void | Promise<void>'.
  Types of parameters '__0' and 'args_0' are incompatible.
```

The error occurred in a Vitest `it.each` test where the callback function signature didn't match the tuple structure being iterated.

### Why It Wasn't Caught Locally

1. **Separate tsconfig for convex/**: The `convex/` directory has its own `tsconfig.json` that isn't checked by `bun run build`, which only type-checks the main `src/` directory.

2. **Vitest transpiles but doesn't strictly typecheck**: When running `bun test`, Vitest transpiles TypeScript files but doesn't enforce strict type-checking. The tests run successfully because JavaScript doesn't care about the callback arity mismatch at runtime.

3. **Netlify uses stricter checking**: The deployment build process runs a more comprehensive TypeScript check that includes the `convex/` directory, catching the type mismatch.

## Solution

The fix ensures the `it.each` callback function accepts all parameters defined in the test tuple, using an underscore prefix for unused parameters:

```typescript
// BEFORE (broken):
it.each([
  ["SESSION_CREATED", "session"],
  ["PLAYER_JOINED", "player"],
  ["VOTE_SUBMITTED", "vote"],
  // ...
])("creates log for %s (%s)", async (action) => {
  // Callback only accepts 1 param but tuple has 2 elements
  // TypeScript sees this as a signature mismatch
});

// AFTER (fixed):
it.each([
  ["SESSION_CREATED", "session"],
  ["PLAYER_JOINED", "player"],
  ["VOTE_SUBMITTED", "vote"],
  // ...
])("creates log for %s (%s)", async (action, _category) => {
  // Callback accepts both params from the tuple
  // Underscore prefix indicates intentionally unused parameter
});
```

### Verification

1. **Run the Convex TypeScript check directly:**
   ```bash
   bunx tsc --noEmit -p convex/tsconfig.json
   ```
   This should complete without errors.

2. **Run the tests to ensure they still pass:**
   ```bash
   bun test convex/audit.test.ts
   ```

3. **Trigger a Netlify deployment** to confirm the build succeeds.

## Prevention

### Safeguards Added

1. **Unified Typecheck Command**
   ```bash
   bun run typecheck
   ```
   This single command now checks both the frontend (`src/`) and backend (`convex/`) TypeScript configurations, ensuring no type errors slip through in either codebase.

2. **Dedicated Convex Typecheck**
   ```bash
   bun run typecheck:convex
   ```
   For quick backend-only validation during Convex development.

3. **GitHub Actions CI Pipeline** (`.github/workflows/ci.yml`)
   - Runs on every push and pull request to `main`
   - Executes typechecking for both app and Convex configurations separately
   - Runs linting and tests
   - Blocks merges when any check fails

### Commands to Run Before Pushing

```bash
# Full validation (recommended before every push)
bun run typecheck && bun run lint && bun run test:once

# Quick check during development
bun run typecheck:convex  # After Convex changes
bun run build             # After frontend changes
```

### How CI Catches Issues

The GitHub Actions workflow runs four sequential checks:

| Step | Command | What It Catches |
|------|---------|-----------------|
| Typecheck (App) | `bun run build` | Frontend TypeScript errors via `tsconfig.app.json` |
| Typecheck (Convex) | `bunx tsc --noEmit -p convex/tsconfig.json` | Backend TypeScript errors in `convex/` |
| Lint | `bun run lint` | ESLint violations across the codebase |
| Test | `bun run test:once` | Unit test failures |

If any step fails, the workflow stops and the PR cannot be merged until fixed.

## Best Practices

### Checklist for Projects with Separate TypeScript Configs

When a project has multiple `tsconfig.json` files (common with Convex, monorepos, or separate frontend/backend):

- [ ] **Identify all TypeScript configurations** - List every `tsconfig.json` in the project
- [ ] **Verify build command coverage** - Check which configs are actually typechecked by the build
- [ ] **Create unified typecheck script** - Add a single command that validates ALL configs:
  ```json
  "typecheck": "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p other/tsconfig.json"
  ```
- [ ] **Add individual typecheck scripts** - For faster iteration on specific areas
- [ ] **Configure CI to check ALL configs** - Never assume the build catches everything
- [ ] **Document the commands** - Update project README or CLAUDE.md with the correct pre-push workflow
- [ ] **Test the CI locally first** - Run the exact CI commands before pushing the workflow

### Why This Matters

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Convex has its own tsconfig | Backend errors invisible to frontend build | Explicit `tsc --noEmit -p convex/tsconfig.json` |
| Vitest transpiles without strict checks | Type errors pass tests but fail deployment | Separate typecheck step in CI |
| Developers only run `build` | False confidence that code is type-safe | Unified `typecheck` command covers all |

### Key Principle

**Never trust a single build command to catch all TypeScript errors.** When multiple `tsconfig.json` files exist, each must be explicitly validated in CI.

## Related

- [Convex Rules](../../convex_rules.md) - Convex coding guidelines
- [CLAUDE.md](../../../CLAUDE.md) - Project commands and CI/CD section
- `.github/workflows/ci.yml` - GitHub Actions workflow
