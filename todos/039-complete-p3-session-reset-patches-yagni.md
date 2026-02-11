---
status: complete
priority: p3
issue_id: "039"
tags: [code-review, yagni, simplicity]
dependencies: []
---

# Evaluate SESSION_RESET_PATCHES for YAGNI

## Problem Statement
`SESSION_RESET_PATCHES` is defined but has no consumer in this PR. The Simplicity agent flagged it as premature. However, it's explicitly defined in the WAR-37 plan and WAR-45 (session reset) will consume it as the immediate next issue.

## Findings
- Location: `convex/lib/constants.ts:64-73`
- Flagged by 1/6 review agents (Simplicity)
- Counter-argument: WAR-45 is the immediate next issue in Phase 5 and will use this constant
- The plan explicitly specifies this constant for downstream reuse
- Test coverage exists and validates the shape

## Proposed Solutions

### Option 1: Keep as-is
- **Pros**: Ready for WAR-45, matches plan specification, tested
- **Cons**: Technically unused until next PR
- **Effort**: None
- **Risk**: None

### Option 2: Remove and add in WAR-45
- **Pros**: Strict YAGNI compliance
- **Cons**: Loses test coverage, goes against plan spec
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Keep as-is (Option 1). The constant is small, tested, and will be consumed in the immediate next issue. This is planning ahead by 1 PR, not premature abstraction.

## Technical Details
- **Affected Files**: None (decision to keep)
- **Database Changes**: No

## Acceptance Criteria
- [ ] Decision documented
- [ ] No code changes needed

## Work Log

### 2026-02-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage (auto-approved)
- Recommendation: Keep as-is, no changes needed

## Notes
Source: PR #59 code review triage on 2026-02-11
