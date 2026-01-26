---
status: pending
priority: p1
issue_id: "010"
tags: [code-review, security, convex, authentication]
dependencies: []
---

# Missing Backend Authorization on Admin Mutations

## Problem Statement

All admin mutations in the Convex backend (`createSession`, `createMap`, `deleteSession`, etc.) lack authentication checks. The commented-out auth code in `convex/maps.ts` (lines 411-412, 469-470, 529-530) reveals this is a known gap marked as "Phase 2".

**Why it matters:** Any unauthenticated user can call mutations via the Convex API, completely bypassing the admin portal access controls. This is a critical security vulnerability.

## Findings

**Source:** security-sentinel agent, architecture-strategist agent

**Evidence from `/convex/maps.ts`:**
```typescript
// Line 410-412
handler: async (ctx, args) => {
    // TODO: Add authentication check when auth is integrated (Phase 2)
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) throw new ConvexError("Authentication required");
```

**Impact:**
- Complete bypass of admin portal access controls
- Data manipulation by unauthenticated users
- Session hijacking and denial of service potential
- OWASP A01: Broken Access Control

## Proposed Solutions

### Option 1: Uncomment and enable auth checks (Recommended)

**Approach:** Uncomment the existing auth checks in all admin mutations

```typescript
handler: async (ctx, args) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Authentication required");
  // ... rest of handler
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low - code already exists, just needs uncommenting |
| Pros | Quick fix, code already written |
| Cons | Repetitive across many mutations |

### Option 2: Create auth middleware wrapper

**Approach:** Create a wrapper function for consistent enforcement

```typescript
// convex/lib/auth.ts
export const authenticatedMutation = customMutation(mutation, async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Authentication required");
  return { ...ctx, identity };
});
```

| Aspect | Assessment |
|--------|------------|
| Effort | Medium |
| Risk | Low |
| Pros | DRY, consistent enforcement, easier to maintain |
| Cons | Requires refactoring existing mutations |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/maps.ts` - createMap, updateMap, deleteMap, toggleMapActive
- `convex/teams.ts` - createTeam, updateTeam, deleteTeam
- `convex/sessions.ts` - createSession, updateSession, deleteSession
- All other admin mutations

**Database Changes:** None required

## Acceptance Criteria

- [ ] All admin mutations verify `ctx.auth.getUserIdentity()` returns non-null
- [ ] Unauthenticated API calls return "Authentication required" error
- [ ] Existing tests updated to mock authenticated context
- [ ] Manual test: calling mutation without auth token fails

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Created during PR #43 review | Auth checks exist but are commented out |

## Resources

- PR #43: https://github.com/Esk3tit/wtcs-map-vote/pull/43
- Convex Auth docs: https://docs.convex.dev/auth
- OWASP A01: https://owasp.org/Top10/A01_2021-Broken_Access_Control/
