---
status: complete
priority: p2
issue_id: "076"
tags: [code-review, sentry, performance]
dependencies: []
---

# Remove Convex from tracePropagationTargets

## Problem Statement
`tracePropagationTargets` includes `/^https:\/\/.*\.convex\.cloud/` which matches any `*.convex.cloud` subdomain. Convex does not participate in Sentry distributed tracing, so `sentry-trace` and `baggage` headers are injected into every Convex request for no benefit.

## Findings
- Location: `src/lib/sentry.ts:32`
- Flagged by: security-sentinel, performance-oracle
- Headers add bytes to every request with no functional benefit
- Could cause preflight CORS issues if Convex tightens policy

## Proposed Solutions

### Option 1: Remove Convex pattern, keep same-origin only
- **Pros**: Clean, no unnecessary headers on third-party requests
- **Cons**: None
- **Effort**: Small (one-line change)
- **Risk**: Low

## Recommended Action
Change to `tracePropagationTargets: [/^\//]`

## Technical Details
- **Affected Files**: `src/lib/sentry.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] `tracePropagationTargets` only includes same-origin pattern
- [ ] No `sentry-trace` headers on Convex requests

## Work Log

### 2026-03-01 - Approved for Work
**By:** Claude Triage System

## Notes
Source: PR #94 code review
