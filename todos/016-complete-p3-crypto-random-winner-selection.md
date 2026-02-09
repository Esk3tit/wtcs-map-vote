---
status: complete
priority: p3
issue_id: "016"
tags: [code-review, security, quality]
dependencies: []
---

# Consider crypto.getRandomValues() for random winner selection

## Problem Statement

`Math.random()` at `convex/voting.ts:328` is used for random winner selection during double deadlock. While Convex overrides `Math.random()` to be deterministic across transaction retries, `Math.random()` is not cryptographically secure. For competitive integrity in a voting tool, a CSPRNG would be more appropriate.

## Findings

- `convex/voting.ts:328` — `Math.floor(Math.random() * currentRoundPool.length)`
- Practical exploitability is low (server-side, small pool, attacker must force double deadlock)
- Convex runtime patches `Math.random()` for deterministic retry behavior
- Source: Security Sentinel reviewer

## Proposed Fix

Replace with `crypto.getRandomValues()`:
```typescript
const randomBuffer = new Uint32Array(1);
crypto.getRandomValues(randomBuffer);
const randomIndex = randomBuffer[0] % currentRoundPool.length;
```

## Files to Modify

- `convex/voting.ts:328` — Replace Math.random with crypto.getRandomValues
