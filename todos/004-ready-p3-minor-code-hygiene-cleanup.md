---
status: done
priority: p3
issue_id: "004"
tags: [code-review, quality, cleanup]
dependencies: []
---

# Minor Code Hygiene Cleanup

## Problem Statement

Several minor code quality items identified during review. None affect functionality but improve code hygiene.

## Findings

### 1. Inline `formatAbsoluteTime` (lines 94-96)
One-liner wrapper around `new Date(ts).toLocaleString()` used once at line 537. The wrapper adds a name for something already self-documenting.

### 2. `setTimeout` leak in `handleCopyToken` (lines 220-228)
If the component unmounts before the 2-second timeout fires, `setCopiedToken(null)` runs on an unmounted component. While React 19 no longer warns, it is a wasted update. Could use a ref to clear on unmount.

### 3. Remove `aria-atomic="false"` (line 503)
This is the default value for the `log` role and adds no semantic value.

### 4. Handler defined after early returns (line 220)
`handleCopyToken` is defined after the loading/null early returns. While valid (not a hook), other admin pages define handlers before early returns for consistency.

### 5. Section dividers in frontend file
The `// ====...` section dividers follow the Convex backend convention but are not used in any other frontend file. Acceptable given the file size but atypical.

## Proposed Solutions

### Solution A: Address all items (Recommended)
1. Inline `formatAbsoluteTime`: `title={new Date(log.timestamp).toLocaleString()}`
2. Add `useRef`+`useEffect` for timeout cleanup
3. Remove `aria-atomic="false"`
4. Move handler and derived values before early returns
5. Leave section dividers (acceptable for large files)

- **Pros:** Cleaner code, consistent patterns
- **Cons:** Minimal impact
- **Effort:** Small
- **Risk:** Low

## Acceptance Criteria

- [ ] `formatAbsoluteTime` function removed, inlined at call site
- [ ] Copy timeout cleared on unmount
- [ ] No unnecessary ARIA defaults
- [ ] TypeScript typecheck passes

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-24 | Created | From PR #37 code review |
| 2026-01-24 | Approved | Triage: approved for fixing |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/37
