---
title: Convex Auth OAuth Login Failures and Race Conditions
category: integration-issues
tags: [convex, auth, oauth, google, race-condition, jwt, tanstack-router]
created: 2026-02-03
problem_type: integration_issue
severity: critical
components: [convex-auth, oauth, tanstack-router, admin-auth]
related_issues: [WAR-26, PR-45]
---

# Convex Auth OAuth Login Failures and Race Conditions

## Problem

Admin Google OAuth login was completely broken after integrating `@convex-dev/auth`. Three distinct failures compounded into what appeared as a single symptom: clicking "Continue with Google" would complete the OAuth flow but the user would never become authenticated, or login would work intermittently (~1 in 8 attempts).

### Symptoms Observed

1. OAuth redirect completes but user stays on login page
2. `ReturnsValidationError` in Convex function logs
3. Login succeeds intermittently (roughly 1 in 8 attempts)
4. `getCurrentAdmin()` returns `null` despite valid OAuth session

## Root Causes

Three independent bugs were identified:

### 1. JWT Missing Email Claim (`getCurrentAdmin`)

**File:** `convex/lib/auth.ts`

The `getCurrentAdmin()` helper used `ctx.auth.getUserIdentity()` and read `identity.email` directly from the JWT. However, `@convex-dev/auth` JWTs do **not** include an `email` claim — the JWT subject contains a composite `userId|sessionId` string, and user data lives in the `users` table.

```typescript
// BROKEN — identity.email is undefined in @convex-dev/auth JWTs
export async function getCurrentAdmin(ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) return null;  // Always null!
  // ...
}
```

**Fix:** Use `getAuthUserId()` from `@convex-dev/auth/server` to extract the userId from the JWT subject, then look up the user's email from the `users` table:

```typescript
import { getAuthUserId } from "@convex-dev/auth/server";

export async function getCurrentAdmin(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const user = await ctx.db.get(userId);
  if (!user?.email) return null;

  const normalizedEmail = normalizeEmail(user.email);
  return await ctx.db
    .query("admins")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .first();
}
```

### 2. Return Validator Mismatch (`_creationTime`)

**File:** `convex/admins.ts`

Once the auth fix above made `getCurrentAdmin()` actually return data, admin query return validators started failing with `ReturnsValidationError`. The validators defined exact object shapes but didn't account for `_creationTime`, which Convex automatically adds to all documents.

```typescript
// BROKEN — returns full Doc<"admins"> which includes _creationTime
export const getMe = query({
  returns: v.object({
    _id: v.id("admins"),
    email: v.string(),
    name: v.string(),
    // ... no _creationTime!
  }),
  handler: async (ctx) => {
    return await getCurrentAdmin(ctx);  // Includes _creationTime → validation fails
  },
});
```

**Fix:** Add a `toAdminResponse()` helper that strips `_creationTime` before returning:

```typescript
function toAdminResponse(admin: Doc<"admins">) {
  const { _creationTime, ...rest } = admin;
  return rest;
}

export const getMe = query({
  handler: async (ctx) => {
    const admin = await getCurrentAdmin(ctx);
    return admin ? toAdminResponse(admin) : null;
  },
});
```

### 3. OAuth Callback Race with `beforeLoad` Redirect

**Files:** `src/routes/index.tsx`, `src/routes/login.tsx`

The index route used TanStack Router's `beforeLoad` to redirect:

```typescript
// BROKEN — strips ?code= before ConvexAuthProvider can process it
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/dashboard' })
  },
})
```

Google OAuth redirects back to `/` with `?code=<authorization_code>`. The `beforeLoad` hook fires during the render phase and immediately redirects, stripping the `?code=` parameter before `ConvexAuthProvider`'s `useEffect` can read `window.location.search` to complete the code exchange. This caused the ~1-in-8 success rate (only worked when the React render cycle happened to process the code before the redirect).

**Fix:** Replace `beforeLoad` redirect with a component-level redirect that checks auth state and respects in-flight OAuth:

```typescript
// src/routes/index.tsx
const OAUTH_FLAG = 'oauthInProgress'

function IndexRedirect() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const navigate = useNavigate()
  const [oauthPending] = useState(
    () => sessionStorage.getItem(OAUTH_FLAG) === 'true',
  )

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        sessionStorage.removeItem(OAUTH_FLAG)
        void navigate({ to: '/admin/dashboard', replace: true })
      } else if (!oauthPending) {
        void navigate({ to: '/login', replace: true })
      }
      // oauthPending && !isAuthenticated: stay on spinner, wait for code exchange
    }
  }, [isAuthenticated, isLoading, oauthPending, navigate])

  // Fallback timeout in case code exchange never completes
  useEffect(() => {
    if (!oauthPending) return
    const timeout = setTimeout(() => {
      sessionStorage.removeItem(OAUTH_FLAG)
      void navigate({ to: '/login', replace: true })
    }, 5000)
    return () => clearTimeout(timeout)
  }, [oauthPending, navigate])

  return <Loader2 className="animate-spin" />
}
```

The login page sets the flag before initiating OAuth and also calls `signOut()` first to clear stale refresh tokens:

```typescript
// src/routes/login.tsx
const handleGoogleSignIn = async () => {
  sessionStorage.setItem('oauthInProgress', 'true')
  await signOut()  // Clear stale tokens to prevent refresh race
  await signIn("google")
}
```

## Additional Fixes

### Test Setup for `getAuthUserId`

The test setup needed updating because `getAuthUserId` parses the JWT subject in `userId|sessionId` format and looks up the user in the `users` table:

```typescript
// convex/test.setup.ts
export async function createAuthenticatedAdmin() {
  const t = createTestContext();

  // Must insert auth user into users table (getAuthUserId does db.get(userId))
  const authUserId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: TEST_ADMIN_DATA.email, name: TEST_ADMIN_DATA.name })
  );

  const adminId = await t.run(async (ctx) =>
    ctx.db.insert("admins", TEST_ADMIN_DATA)
  );

  // Subject must be "userId|sessionId" format
  const authT = t.withIdentity({
    name: TEST_ADMIN_DATA.name,
    subject: `${authUserId}|fake_session_id`,
    issuer: "https://auth.example.com",
  });

  return { t, authT, adminId };
}
```

### Auth Redirect on Login Page

Added a redirect for already-authenticated users landing on `/login`:

```typescript
useEffect(() => {
  if (!authLoading && isAuthenticated) {
    void navigate({ to: '/admin/dashboard', replace: true })
  }
}, [isAuthenticated, authLoading, navigate])
```

## Prevention

1. **Never assume JWT claims exist** — `@convex-dev/auth` JWTs are minimal. Always use `getAuthUserId()` instead of reading `identity.email` or other claims directly.

2. **Always strip `_creationTime` from query returns** — When defining explicit return validators for Convex queries, remember that `Doc<"table">` includes `_creationTime` which isn't in your schema definition. Create helper functions to strip system fields.

3. **Never use `beforeLoad` for redirects when OAuth callbacks land on the route** — OAuth providers redirect with query parameters (`?code=`, `?state=`) that must be preserved for the auth library to complete the exchange. Use component-level redirects with loading states instead.

4. **Call `signOut()` before `signIn()` in OAuth flows** — Stale refresh tokens can cause race conditions where the auth library tries to refresh an old session while simultaneously processing the new OAuth code.

5. **Update test setup when changing auth internals** — When switching from `ctx.auth.getUserIdentity()` to `getAuthUserId()`, the test identity format changes from email-based matching to userId-based matching with the `userId|sessionId` subject format.

## Debugging Tips

- Check Convex function logs for `ReturnsValidationError` — this indicates return validator mismatches, often caused by `_creationTime` not being stripped.
- If `getCurrentAdmin()` returns `null`, verify that `getAuthUserId()` returns a valid userId and that the `users` table has the corresponding record with an `email` field.
- If OAuth login is intermittent, check whether route-level redirects are stripping `?code=` from the URL before the auth library can read it.

## Related

- [Type-Safe OAuth Profile Extraction](../convex-patterns/type-safe-oauth-profile-extraction.md)
- [Convex-Test Auth Whitelist Pattern](../test-failures/convex-test-auth-whitelist-pattern.md)
- [@convex-dev/auth Documentation](https://labs.convex.dev/auth)
- PR #45: Player token auth (where these fixes were applied)
- WAR-26: Admin OAuth login failures Linear issue
