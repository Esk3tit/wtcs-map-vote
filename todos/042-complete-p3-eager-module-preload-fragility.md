---
status: complete
priority: p3
issue_id: "042"
tags: [code-review, performance, audio]
dependencies: []
---

# Module-Level Eager Preload Fragility

## Problem Statement

`audio.ts` creates `Audio` elements and calls `preload()` at module scope (top-level). This means all 6 sound files begin downloading as soon as the module is imported, regardless of whether the user will ever interact with audio. On slow connections or mobile devices, this adds unnecessary network requests. The module-level singleton also means `Audio` objects are created even in SSR/test environments where `Audio` doesn't exist.

## Findings

- **security-sentinel**: Noted module-level side effects as a concern
- **performance-oracle**: Flagged eager preload as CRITICAL-1
- **code-simplicity-reviewer**: Suggested lazy initialization pattern
- Location: `src/lib/audio.ts` (module scope)

## Proposed Solutions

### Option 1: Lazy Initialization
- Defer `Audio` element creation until `setupUnlock()` is first called
- Preload sounds only after the first user interaction unlocks audio
- **Pros**: No wasted network requests, SSR-safe
- **Cons**: Slight delay on first sound play (download time)
- **Effort**: Small
- **Risk**: Low (sounds have time to load between unlock and first trigger)

### Option 2: Leave As-Is
- Vite code-splits, so the module only loads on the vote page
- 288KB total is small — preloading ensures instant playback
- **Pros**: Instant sound playback, no latency
- **Cons**: Extra requests on page load
- **Effort**: None
- **Risk**: None

## Recommended Action

Option 2: Leave as-is. Vite code-splits so module only loads on vote page. 288KB total is small and preloading ensures instant playback.

## Technical Details

- **Affected Files**: `src/lib/audio.ts`
- **Related Components**: `useAudio.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Sounds don't preload until needed (if fixing)
- [ ] First sound playback has acceptable latency
- [ ] Works correctly in SSR/test environments

## Work Log

### 2026-02-25 - Created from code review
**By:** Claude Code Review
**Actions:**
- Identified during PR #84 review (WAR-62 Audio Alerts)
- Flagged by 3 review agents

## Resources

- PR: #84
- `src/lib/audio.ts`
