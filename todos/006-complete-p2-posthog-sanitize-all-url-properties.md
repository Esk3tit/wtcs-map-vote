---
status: complete
priority: p2
issue_id: "006"
tags: [code-review, security, posthog]
dependencies: []
---

# Extend PostHog sanitize_properties to cover all URL-bearing properties

## Problem Statement

The `sanitize_properties` function in `src/lib/posthog.ts` only redacts player tokens from `$current_url` and `$pathname`. PostHog automatically captures several other URL-bearing properties that could leak tokens: `$referrer`, `$initial_referrer`, `$initial_current_url`, `$session_entry_url`, and `$session_entry_pathname`.

If a user navigates from `/vote/{token}` to another page, the referrer will contain the token in cleartext.

## Findings

- `sanitize_properties` currently handles `$pathname` and `$current_url` only
- PostHog captures: `$referrer`, `$initial_referrer`, `$initial_current_url`, `$session_entry_url`, `$session_entry_pathname`
- All of these can contain `/vote/{token}` or `/lobby/{token}` paths
- Location: `src/lib/posthog.ts` — `sanitize_properties` callback
- Found by: security-sentinel, architecture-strategist agents

## Proposed Solutions

### Option 1: Apply redactPath to all URL-bearing properties
- **Pros**: Comprehensive coverage, simple loop
- **Cons**: None significant
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Loop over all known URL-bearing property keys and apply `redactPath` + query param stripping to each.

## Technical Details

- **Affected Files**: `src/lib/posthog.ts`
- **Related Components**: PostHog analytics integration
- **Database Changes**: No

## Acceptance Criteria

- [x] `$referrer` tokens are redacted
- [x] `$initial_referrer` tokens are redacted
- [x] `$initial_current_url` tokens are redacted
- [x] `$session_entry_url` tokens are redacted
- [x] `$session_entry_pathname` tokens are redacted (path only, no query)
- [x] Tests pass
- [x] Code reviewed

## Work Log

### 2026-03-02 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved)
- Status set to ready
- Ready to be picked up and worked on

**Learnings:**
- PostHog captures many URL properties beyond the obvious two

## Resources

- Original finding: PR #96 code review (security-sentinel, architecture-strategist)
- PostHog docs on auto-captured properties

## Notes

Source: Triage session on 2026-03-02
