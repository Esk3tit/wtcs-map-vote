---
status: ready
priority: p3
issue_id: "006"
tags: [code-review, quality, testing]
dependencies: []
---

# Extract audit log verification helper in tests

## Problem Statement

The lifecycle mutation tests repeat the same audit log verification pattern 7+ times: query `auditLogs` table, filter by sessionId, assert action matches expected value, check actorType/actorId. Extracting this into a test helper would reduce duplication and make tests more readable.

## Findings

- **Location:** `convex/sessions.test.ts` — across all lifecycle mutation test blocks
- **Agents:** pattern-recognition-specialist
- **Context:** Pattern is roughly:
  ```typescript
  const logs = await t.query(api.audit.getSessionAuditLogs, { sessionId });
  expect(logs).toHaveLength(N);
  expect(logs[0].action).toBe("SESSION_WHATEVER");
  expect(logs[0].actorType).toBe("ADMIN");
  ```
  This appears in finalizeSession, startSession, pauseSession, resumeSession, and endSession test blocks.

## Proposed Solutions

### Option 1: Extract helper function (Recommended)
- Create `expectAuditLog(t, sessionId, { action, actorType, index?, length? })` helper at top of test file
- **Pros:** DRY, consistent assertions, easier to add new audit checks
- **Cons:** One more abstraction to understand
- **Effort:** Small
- **Risk:** Low

### Option 2: Leave as-is
- Explicit assertions are self-documenting
- **Pros:** No abstraction overhead
- **Cons:** ~50 lines of duplication across test file
- **Effort:** None
- **Risk:** None

## Recommended Action

Option 1: Extract `expectAuditLog(t, sessionId, { action, actorType })` helper at top of test file. Replace 7 inline patterns.

## Technical Details

- **Affected Files:** `convex/sessions.test.ts`
- **Related Components:** All lifecycle mutation tests
- **Database Changes:** No

## Acceptance Criteria

- [ ] Audit log helper extracted (if approved)
- [ ] All existing audit assertions preserved
- [ ] All tests still pass

## Work Log

### 2026-02-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (approve all)
- Status changed from pending to ready

### 2026-02-11 - Created from code review
**By:** Claude Review System
**Actions:**
- Identified by pattern-recognition agent during PR #60 review

## Resources

- PR #60: https://github.com/Esk3tit/wtcs-map-vote/pull/60
