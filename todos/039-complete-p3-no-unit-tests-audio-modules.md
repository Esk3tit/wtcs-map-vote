---
status: complete
priority: p3
issue_id: "039"
tags: [code-review, testing, audio]
dependencies: []
---

# No Unit Tests for Audio Modules (~329 New Lines)

## Problem Statement

PR #84 adds ~329 lines of new code across `audio.ts`, `useAudio.ts`, and `useAudioAlerts.ts` with zero unit tests. While the audio system is largely browser-API dependent (making full testing difficult), the core logic — suppression rules, phase transition detection, timer threshold calculation — is testable.

## Findings

- **pattern-recognition-specialist**: Flagged missing test coverage
- **architecture-strategist**: Noted tests would help prevent regression
- **kieran-typescript-reviewer**: Recommended tests for suppression logic
- Files without tests: `src/lib/audio.ts`, `src/hooks/useAudio.ts`, `src/hooks/useAudioAlerts.ts`

## Proposed Solutions

### Option 1: Test Pure Logic Only
- Extract testable logic (suppression rules, phase transition detection) into pure functions
- Test those functions without browser APIs
- **Pros**: High value, easy to write, fast to run
- **Cons**: Doesn't test browser integration
- **Effort**: Medium
- **Risk**: Low

### Option 2: Integration Tests with Mock Audio
- Mock `HTMLAudioElement` and test the full hook lifecycle
- **Pros**: Higher coverage, tests actual hook behavior
- **Cons**: Complex mocking setup, brittle tests
- **Effort**: Large
- **Risk**: Medium

### Option 3: Accept No Tests (Document Decision)
- Audio is a non-critical UI enhancement — manual testing is sufficient
- **Pros**: No effort, no maintenance burden
- **Cons**: Regression risk on future changes
- **Effort**: None
- **Risk**: Low (audio bugs are non-critical)

## Recommended Action

Option 3: Accept no tests. Audio is a non-critical UI enhancement. Manual testing is sufficient. Document the decision.

## Technical Details

- **Affected Files**: `src/lib/audio.ts`, `src/hooks/useAudio.ts`, `src/hooks/useAudioAlerts.ts`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] Core suppression logic has test coverage (if fixing)
- [ ] Phase transition detection is tested (if fixing)
- [ ] Timer threshold logic is tested (if fixing)

## Work Log

### 2026-02-25 - Created from code review
**By:** Claude Code Review
**Actions:**
- Identified during PR #84 review (WAR-62 Audio Alerts)
- Flagged by 3 review agents

## Resources

- PR: #84
