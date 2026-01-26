---
status: complete
priority: p2
issue_id: "012"
tags: [code-review, error-handling, react, authentication]
dependencies: []
---

# Missing Error Handling in Logout Flow

## Problem Statement

The logout handler in `admin-sidebar.tsx` calls `signOut()` without error handling. If the signOut call fails (network error, session already invalidated), the user gets an unhandled promise rejection and the navigation never happens.

**Why it matters:** Users could get stuck in a broken state if logout fails, unable to navigate away from the admin area.

## Findings

**Source:** kieran-typescript-reviewer agent, architecture-strategist agent

**Current code in `src/components/layout/admin-sidebar.tsx:24-27`:**
```typescript
const handleLogout = async () => {
  await signOut()
  void navigate({ to: '/login' })  // Never reached if signOut throws
}
```

**Issues:**
1. If `signOut()` throws, navigation never happens
2. User sees unhandled promise rejection
3. UI remains in admin state despite user intent to leave

## Proposed Solutions

### Option 1: Try-catch with always navigate (Recommended)

```typescript
const handleLogout = async () => {
  try {
    await signOut()
  } catch (error) {
    console.error('Logout failed:', error)
    // Optionally show toast notification
  } finally {
    // Always navigate - user intended to leave
    void navigate({ to: '/login' })
  }
}
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Very Low |
| Pros | User always navigates to login, graceful degradation |
| Cons | Silently fails if signOut actually needed |

### Option 2: Show error and retry option

```typescript
const handleLogout = async () => {
  try {
    await signOut()
    void navigate({ to: '/login' })
  } catch (error) {
    toast.error('Logout failed. Please try again.')
  }
}
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | User knows logout failed, can retry |
| Cons | User stuck in admin area if persistent failure |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `src/components/layout/admin-sidebar.tsx`

**Database Changes:** None

## Acceptance Criteria

- [ ] Logout errors are caught and logged
- [ ] User always navigates to login page after clicking logout
- [ ] No unhandled promise rejections in console

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Created during PR #43 review | - |

## Resources

- PR #43: https://github.com/Esk3tit/wtcs-map-vote/pull/43
