---
status: complete
priority: p1
issue_id: "019"
tags: [code-review, performance, react, memory-leak]
dependencies: []
---

# Blob URL Memory Leak in ImageSourcePicker

## Problem Statement

The `ImageSourcePicker` component creates blob URLs via `URL.createObjectURL()` for image previews but never revokes them with `URL.revokeObjectURL()`. This causes memory leaks as each file selection accumulates blob references in browser memory. For 2MB images (max size), repeated file selections can quickly exhaust memory.

## Findings

### Performance Review Finding
- **Location:** `src/components/ui/image-source-picker.tsx:98`
- **Evidence:**
  ```typescript
  const handleFileSelect = useCallback(
    (file: File) => {
      // ...validation...
      const previewUrl = URL.createObjectURL(file);  // LEAK: Never revoked
      onChange({ type: "upload", file, previewUrl });
    },
    [onChange]
  );
  ```

### Memory Impact
- Each blob URL holds reference to entire file in memory
- 2MB max file size × N selections = N×2MB accumulated
- No cleanup on:
  - New file selection (should revoke old URL first)
  - Clearing selection
  - Component unmount

## Proposed Solutions

### Solution 1: Add Cleanup in Component (Recommended)
**Description:** Revoke old blob URLs when creating new ones and on unmount.

```typescript
// In handleFileSelect - revoke previous before creating new
const handleFileSelect = useCallback(
  (file: File) => {
    if (value.type === "upload" && value.previewUrl) {
      URL.revokeObjectURL(value.previewUrl);
    }
    // ... rest of implementation
  },
  [onChange, value]
);

// Add cleanup on unmount
useEffect(() => {
  return () => {
    if (value.type === "upload" && value.previewUrl) {
      URL.revokeObjectURL(value.previewUrl);
    }
  };
}, [value]);
```

**Pros:** Simple, addresses all leak scenarios
**Cons:** Requires tracking previous value
**Effort:** Small (30 min)
**Risk:** Low

### Solution 2: Parent Component Cleanup
**Description:** Handle cleanup in `teams.tsx` where state is managed.

**Pros:** Centralized cleanup
**Cons:** Splits responsibility, easy to forget in other usages
**Effort:** Small (30 min)
**Risk:** Low

## Recommended Action

[To be filled during triage]

## Technical Details

**Affected Files:**
- `src/components/ui/image-source-picker.tsx`
- `src/routes/admin/teams.tsx` (for unmount cleanup)

**Cleanup Points:**
1. `handleFileSelect` - before creating new URL
2. `handleClear` - when clearing selection
3. `useEffect` cleanup - on unmount

## Acceptance Criteria

- [ ] Previous blob URL is revoked when selecting new file
- [ ] Blob URL is revoked when clearing selection
- [ ] Blob URL is revoked when component unmounts
- [ ] Memory profiler shows no accumulated blob URLs after multiple selections

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from code review | Performance and architecture agents both flagged this |

## Resources

- PR #17: https://github.com/Esk3tit/wtcs-map-vote/pull/17
- MDN URL.createObjectURL: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
- MDN URL.revokeObjectURL: https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL
