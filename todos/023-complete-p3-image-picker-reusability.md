---
status: complete
priority: p3
issue_id: "023"
tags: [code-review, architecture, react, reusability]
dependencies: []
---

# ImageSourcePicker Has Hardcoded Label

## Problem Statement

The `ImageSourcePicker` component has a hardcoded label "Team Logo (Optional)" which limits its reusability for other entities like Maps that may need similar image upload functionality.

## Findings

### Architecture Review Finding
- **Location:** `src/components/ui/image-source-picker.tsx:176`
- **Evidence:**
  ```tsx
  <Label>Team Logo (Optional)</Label>
  ```

### Reusability Impact
- Cannot reuse for Maps without modification
- SPECIFICATION.md mentions "Map images should use Convex file storage"
- Future entities may need similar functionality

## Proposed Solutions

### Solution 1: Add Label Prop (Recommended)
**Description:** Accept label as a configurable prop with sensible default.

```typescript
interface ImageSourcePickerProps {
  label?: string;
  // ... existing props
}

// Usage
<Label>{label ?? "Image (Optional)"}</Label>
```

**Pros:** Simple, backward compatible
**Cons:** Minimal
**Effort:** Small (15 min)
**Risk:** Low

## Recommended Action

[To be filled during triage]

## Technical Details

**Affected Files:**
- `src/components/ui/image-source-picker.tsx`

## Acceptance Criteria

- [ ] Label is configurable via prop
- [ ] Default label is generic ("Image (Optional)")
- [ ] Teams page passes "Team Logo (Optional)"

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-13 | Created from code review | Architecture agent flagged for reusability |

## Resources

- PR #17: https://github.com/Esk3tit/wtcs-map-vote/pull/17
