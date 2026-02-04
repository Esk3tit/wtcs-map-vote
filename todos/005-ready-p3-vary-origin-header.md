---
status: complete
priority: p3
issue_id: "005"
tags: [cors, headers, hardening]
dependencies: []
---

# Add `Vary: Origin` Header When Origin Is Specific

## Problem Statement
When `getCorsHeaders()` returns a specific origin (not `"*"`), the response should include `Vary: Origin` for cache correctness. This ensures caching proxies do not serve a response with the wrong `Access-Control-Allow-Origin` to a different origin.

## Findings
- Location: `convex/http.ts`
- Found by: Architecture strategist
- Unlikely to cause issues in practice since Convex endpoints aren't behind CDN caching
- Defense-in-depth measure

## Proposed Solutions

### Option 1: Add conditional Vary header
- **Pros**: Correct per HTTP spec, defense-in-depth
- **Cons**: Minor complexity
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Add `...(origin !== "*" ? { Vary: "Origin" } : {})` to the return object in `getCorsHeaders()`.

## Technical Details
- **Affected Files**: `convex/http.ts`
- **Related Components**: CORS configuration
- **Database Changes**: No

## Resources
- Original finding: WAR-27 code review (PR #47)

## Acceptance Criteria
- [x] `Vary: Origin` header added when origin is not `"*"`
- [x] Typecheck passes

## Work Log

### 2026-02-04 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes
Source: Triage session on 2026-02-04
