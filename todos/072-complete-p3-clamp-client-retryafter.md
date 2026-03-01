---
status: complete
priority: p3
issue_id: "072"
tags: [code-review, security, rate-limiting]
dependencies: []
---

# Clamp client-side retryAfter to prevent indefinite waits

## Problem Statement

In `usePlayerAuth.ts`, the `startRetrySequence` function uses server-provided `retryAfterMs` directly without an upper bound. A server misconfiguration or malicious response could cause the client to wait indefinitely.

## Findings

- **Location**: `src/hooks/usePlayerAuth.ts:263-265`
- **Evidence**: `const delayMs = retryAfterMs && retryAfterMs > 0 ? retryAfterMs : RETRY_DELAYS_MS[attempt]` — no maximum check
- **Flagged by**: security-sentinel

## Proposed Solutions

### Option A: Add MAX_RETRY_DELAY_MS constant (Recommended)
- Add `const MAX_RETRY_DELAY_MS = 60_000` and clamp: `Math.min(retryAfterMs, MAX_RETRY_DELAY_MS)`
- **Pros**: Simple, prevents runaway waits, 60s is reasonable upper bound
- **Cons**: Could ignore legitimate long backoff from server
- **Effort**: Small
- **Risk**: Low

## Technical Details

**Affected files:**
- `src/hooks/usePlayerAuth.ts` — `startRetrySequence` function

## Acceptance Criteria

- [ ] retryAfter delay clamped to a reasonable maximum (e.g., 60s)
- [ ] Fallback to exponential backoff still works when retryAfter exceeds max

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-03-01 | Created | From PR #93 code review |
| 2026-03-01 | Approved | Triage: approved all findings — status pending → ready |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/93
