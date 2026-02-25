---
status: complete
priority: p3
issue_id: "035"
tags: [code-review, security, pre-existing]
dependencies: []
---

# Eliminate modulo bias in pickRandom CSPRNG

## Problem Statement

`pickRandom()` uses `buf[0] % items.length` which has theoretical modulo bias (~2.3x10^-10) when `items.length` doesn't evenly divide 2^32. Inconsequential for this use case but a cosmetic improvement for competitive integrity perfectionism.

## Findings

- Location: `convex/lib/random.ts`
- Pre-existing — not introduced by PR #83
- Bias magnitude: ~2.3x10^-10 for typical array sizes (3-15 maps)
- Current implementation uses `crypto.getRandomValues()` which is correct

## Proposed Solutions

### Option 1: Rejection sampling
```typescript
const limit = 0x100000000 - (0x100000000 % items.length);
do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
return items[buf[0] % items.length];
```
- **Pros**: Perfectly uniform distribution
- **Cons**: Theoretical infinite loop (astronomically unlikely)
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Apply rejection sampling for theoretical perfectionism. Low priority.

## Technical Details

- **Affected Files**: `convex/lib/random.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] `pickRandom` uses rejection sampling
- [ ] All tests pass
- [ ] Random selection remains CSPRNG-based

## Resources

- PR #83 review — Security Sentinel
- Pre-existing finding, not blocking

## Work Log

### 2026-02-25 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approve all)
- Status: ready
