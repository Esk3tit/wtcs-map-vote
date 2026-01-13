# TODO: Authentication Missing on Maps Mutations

**Priority:** P1 - Critical (before production)
**Source:** Security Sentinel Review - PR #15
**Created:** 2025-01-12

## Issue

All Maps CRUD mutations (`createMap`, `updateMap`, `deactivateMap`, `reactivateMap`, `generateUploadUrl`) have placeholder TODO comments for authentication but currently allow any unauthenticated user to execute them.

## Impact

- Any internet user can create, modify, or deactivate maps
- `generateUploadUrl` allows unlimited file uploads consuming storage quota
- Attackers can flood the database with garbage data

## Location

- `convex/maps.ts` lines 111-114, 160-163, 222-226, 280-284, 312-316

## Resolution

This is a known Phase 2 task. Options:
1. Implement authentication checks when Phase 2 auth is ready
2. Mark mutations as `internalMutation` until auth is implemented

## Status

- [ ] Tracked for Phase 2 auth implementation

## Notes

Same pattern exists in `convex/teams.ts` - both need auth integration in Phase 2.
