---
status: complete
priority: p3
issue_id: "007"
tags: [logging, cors, operational]
dependencies: []
---

# `console.error` Fires on Every Request When CORS Misconfigured

## Problem Statement
If `FRONTEND_URL` is not set in production, `console.error` fires on every HTTP request (heartbeats every 30s per player). No deduplication is possible in Convex's serverless model. This creates log noise but is not a correctness issue.

## Findings
- Location: `convex/http.ts:52`
- Found by: Performance oracle, pattern recognition specialist
- Impact: Log noise only — not a correctness issue
- Convex's serverless model makes deduplication impossible (each invocation is isolated)

## Proposed Solutions

### Option 1: Downgrade to `console.warn` (minimal change)
- **Pros**: Reduces severity in log aggregators
- **Cons**: Still fires every request
- **Effort**: Small (2 minutes)
- **Risk**: Low

### Option 2: Keep as-is and document
- **Pros**: Loud signal for genuine misconfiguration is intentional
- **Cons**: Log noise if misconfigured
- **Effort**: None
- **Risk**: None

## Recommended Action
Downgrade to `console.warn` since the error is operational (misconfiguration) rather than a code bug. The loud signal is still present but won't trigger error-level alerting.

## Technical Details
- **Affected Files**: `convex/http.ts`
- **Related Components**: CORS configuration, logging
- **Database Changes**: No

## Resources
- Original finding: WAR-27 code review (PR #47)

## Acceptance Criteria
- [ ] `console.error` changed to `console.warn` for CORS misconfiguration
- [ ] Typecheck passes

## Work Log

### 2026-02-04 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes
Source: Triage session on 2026-02-04
