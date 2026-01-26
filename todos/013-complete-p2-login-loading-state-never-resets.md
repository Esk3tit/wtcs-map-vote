---
status: complete
priority: p2
issue_id: "013"
tags: [code-review, error-handling, react, ux]
dependencies: []
---

# Login Loading State Never Resets on Error

## Problem Statement

The login page sets `isLoading(true)` when starting OAuth but never resets it. If the OAuth flow fails or the user cancels and returns to the page, the sign-in button remains disabled forever.

**Why it matters:** Users who cancel OAuth or experience errors cannot retry without refreshing the page.

## Findings

**Source:** kieran-typescript-reviewer agent, code-simplicity-reviewer agent

**Current code in `src/routes/login.tsx:39-42`:**
```typescript
const [isLoading, setIsLoading] = useState(false)

const handleGoogleSignIn = () => {
  setIsLoading(true)
  void signIn("google")  // No error handling, loading never resets
}
```

**Scenarios where this fails:**
- User cancels OAuth popup
- OAuth provider returns error
- Network fails before redirect
- User navigates back to login page

## Proposed Solutions

### Option 1: Add try-catch (Recommended if signIn can throw)

```typescript
const handleGoogleSignIn = async () => {
  setIsLoading(true)
  try {
    await signIn("google")
  } catch (error) {
    setIsLoading(false)
    // Optionally show error toast
  }
}
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Very Low |
| Pros | Handles errors gracefully |
| Cons | May not catch popup cancel (depends on library) |

### Option 2: Add comment acknowledging limitation

```typescript
const handleGoogleSignIn = () => {
  setIsLoading(true)
  // Note: Loading state persists intentionally - successful sign-in redirects away.
  // If user cancels OAuth flow and returns, a page refresh will reset state.
  void signIn("google")
}
```

| Aspect | Assessment |
|--------|------------|
| Effort | Minimal |
| Risk | None |
| Pros | Documents known limitation |
| Cons | Doesn't fix the UX issue |

### Option 3: Reset on window focus

```typescript
useEffect(() => {
  const handleFocus = () => setIsLoading(false)
  window.addEventListener('focus', handleFocus)
  return () => window.removeEventListener('focus', handleFocus)
}, [])
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | Resets when user returns from OAuth popup |
| Cons | May reset prematurely in some edge cases |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `src/routes/login.tsx`

**Database Changes:** None

## Acceptance Criteria

- [ ] Loading state resets if OAuth flow fails/cancels
- [ ] Users can retry sign-in without page refresh
- [ ] Normal successful flow still works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Created during PR #43 review | OAuth redirect behavior may vary |

## Resources

- PR #43: https://github.com/Esk3tit/wtcs-map-vote/pull/43
- Convex Auth signIn: https://docs.convex.dev/auth/convex-auth
