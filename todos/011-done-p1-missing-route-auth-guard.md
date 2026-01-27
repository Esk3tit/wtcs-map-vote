---
status: done
priority: p1
issue_id: "011"
tags: [code-review, security, react, authentication, routing]
dependencies: []
---

# Missing Route-Level Authentication Guard on Admin Routes

## Problem Statement

The admin layout component at `src/routes/admin.tsx` does not check if the user is authenticated before rendering. Any user can access `/admin/dashboard`, `/admin/maps`, `/admin/teams`, etc. without authentication.

**Why it matters:** The admin UI is visible to unauthenticated users. Combined with missing backend auth (issue #010), this creates a complete security bypass.

## Findings

**Source:** security-sentinel agent, architecture-strategist agent

**Current code in `src/routes/admin.tsx`:**
```typescript
function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      {/* No authentication check - renders for anyone */}
```

The `useConvexAuth` hook is exported from `src/lib/convex.ts` but never used in admin routes.

## Proposed Solutions

### Option 1: Add useEffect redirect (Quick fix)

**Approach:** Check auth in component and redirect if not authenticated

```typescript
import { useConvexAuth } from "@/lib/convex";
import { useNavigate } from "@tanstack/react-router";

function AdminLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: '/login' });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return <LoadingSpinner />;
  }
  // ... rest of component
}
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low |
| Pros | Quick to implement, uses existing hooks |
| Cons | Flash of content before redirect possible |

### Option 2: TanStack Router beforeLoad guard (Recommended)

**Approach:** Use route-level guard that prevents rendering entirely

```typescript
export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context }) => {
    const { isAuthenticated } = context.auth;
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: AdminLayout,
})
```

| Aspect | Assessment |
|--------|------------|
| Effort | Medium (requires router context setup) |
| Risk | Low |
| Pros | No flash of content, proper router pattern |
| Cons | Requires additional router configuration |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `src/routes/admin.tsx` - Add auth guard
- Potentially `src/App.tsx` - If router context needs auth state

**Database Changes:** None

## Acceptance Criteria

- [x] Unauthenticated users redirected to `/login` when accessing `/admin/*`
- [x] No flash of admin content before redirect
- [x] Authenticated users can access admin routes normally
- [x] Loading state shown while auth status is determined

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Created during PR #43 review | useConvexAuth hook available but unused |
| 2026-01-27 | Implemented Option 1 (useEffect redirect) | Used Loader2 from lucide-react for loading states, navigate requires search params for /login route |

## Resources

- PR #43: https://github.com/Esk3tit/wtcs-map-vote/pull/43
- TanStack Router Auth: https://tanstack.com/router/latest/docs/framework/react/guide/authenticated-routes
- Convex Auth React: https://docs.convex.dev/auth/convex-auth#react
