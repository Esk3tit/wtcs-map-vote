---
status: complete
priority: p3
issue_id: "017"
tags: [code-review, simplicity, cleanup]
dependencies: []
---

# Remove redundant resetMapIds alias

## Problem Statement

`const resetMapIds = bannedIds` at `convex/voting.ts:276` is a leftover alias from when the variable was populated by a separate DB query. After PR review feedback optimized the code to reuse `bannedIds`, the alias serves no purpose.

## Findings

- `convex/voting.ts:276` — `const resetMapIds = bannedIds;`
- Used at lines 278, 302, 308 — all could use `bannedIds` directly
- Source: Code Simplicity reviewer

## Proposed Fix

Remove the alias, replace 3 uses of `resetMapIds` with `bannedIds`.

## Files to Modify

- `convex/voting.ts:276-308` — Inline the alias
