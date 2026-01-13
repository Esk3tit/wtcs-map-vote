# RESOLVED: Maps CRUD Minor Improvements

**Priority:** P3 - Low
**Status:** RESOLVED (2025-01-12)
**Source:** Code Simplicity and Security Reviews - PR #15
**Created:** 2025-01-12

## Issues

### 1. Unused `by_isActive` Index (Simplicity Review)

The standalone `by_isActive` index is not used anywhere - the compound index `by_isActive_and_name` covers all current queries.

**Location:** `convex/schema.ts` line 28

**Action:** Consider removing to reduce write overhead. Keep only `by_name` and `by_isActive_and_name`.

### 2. Session Name Leakage in Error Messages (Security Review)

Error messages in `deactivateMap` leak session names:
```typescript
throw new ConvexError(
  `Cannot deactivate map "${map.name}": used in active session "${activeSession.matchName}"`
);
```

**Location:** `convex/maps.ts` lines 257-259

**Action:** Consider sanitizing to:
```typescript
throw new ConvexError(
  `Cannot deactivate map "${map.name}": it is currently in use in an active session`
);
```

### 3. URL Validation Could Block Private IPs (Security Review)

The `isValidImageUrl` function doesn't block internal/private IPs. While URLs are client-rendered and not fetched server-side, blocking private IPs is defense-in-depth.

**Location:** `convex/maps.ts` lines 23-32

**Action:** Consider adding private IP blocking if server-side fetching is ever added.

### 4. Duplicated Constants (Simplicity Review)

Both `maps.ts` and `teams.ts` define identical constants:
- `MAX_NAME_LENGTH = 100`
- `MAX_URL_LENGTH = 2048`
- `ACTIVE_SESSION_STATUSES` Set

**Action:** Could extract to `convex/lib/constants.ts` for DRY, but consistency with existing pattern is also valid.

## Status

- [x] Evaluate index removal - DONE: Removed unused by_isActive index
- [x] Sanitize error messages - DONE: Removed session name from error message
- [x] Consider shared constants extraction - DONE: Created convex/lib/constants.ts

## Resolution

All items implemented in commit 08bace4:
1. Removed unused `by_isActive` index from schema.ts
2. Sanitized error message in deactivateMap to not leak session names
3. Extracted shared constants to `convex/lib/constants.ts`

## Notes

These are minor improvements and not blocking for the PR. Address when convenient.
