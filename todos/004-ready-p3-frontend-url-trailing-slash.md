---
status: complete
priority: p3
issue_id: "004"
tags: [cors, security, hardening]
dependencies: []
---

# Add Trailing Slash Normalization to FRONTEND_URL

## Problem Statement
If `FRONTEND_URL` is set with a trailing slash (e.g., `https://app.example.com/`), CORS matching will fail because browser `Origin` headers never include trailing slashes.

## Findings
- Location: `convex/http.ts:48`
- Found by: Architecture strategist, pattern recognition specialist
- Defensive hardening measure

## Proposed Solutions

### Option 1: Strip trailing slashes from FRONTEND_URL
- **Pros**: Prevents misconfiguration failures
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Add `origin = env.FRONTEND_URL.replace(/\/+$/, '')` after reading the env var.

## Technical Details
- **Affected Files**: `convex/http.ts`
- **Related Components**: CORS configuration
- **Database Changes**: No

## Resources
- Original finding: WAR-27 code review (PR #47)

## Acceptance Criteria
- [ ] Trailing slash normalization added to FRONTEND_URL usage
- [ ] Typecheck passes

## Work Log

### 2026-02-04 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes
Source: Triage session on 2026-02-04
