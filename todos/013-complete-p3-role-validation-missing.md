---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, validation, security, sessions, pr-20]
dependencies: []
---

# Missing Role Input Validation

## Problem Statement

The `assignPlayer` mutation accepts a `role` string argument without any validation on content or length. This could allow malicious content, XSS payloads (if rendered unsanitized), or excessively long strings.

## Findings

### Security Sentinel Analysis

**Location:** `/Users/khaiphan/Documents/wtcs-map-vote/convex/sessions.ts` lines 448-449, 481-486

```typescript
args: {
  // ...
  role: v.string(),  // No validation on role format/content
  // ...
}

// Only checks for duplicate role in session
const duplicateRole = existingPlayers.find((p) => p.role === args.role);
```

**Issues:**
1. No validation on role string content
2. No length limit
3. No allowlist of valid roles (though this may be intentional for flexibility)

## Proposed Solutions

### Option A: Apply validateName to Role (Recommended)

Use existing validation helper:
```typescript
const validatedRole = validateName(args.role, "Role");
```

This applies trimming and MAX_NAME_LENGTH (100 chars).

**Pros:** Consistent with other name validation, reuses existing code
**Cons:** May be too strict if roles need special characters
**Effort:** Small
**Risk:** Low

### Option B: Custom Role Validation

Create role-specific validation if requirements differ from names:
```typescript
function validateRole(role: string): string {
  const trimmed = role.trim();
  if (trimmed.length === 0) throw new ConvexError("Role cannot be empty");
  if (trimmed.length > 50) throw new ConvexError("Role cannot exceed 50 characters");
  return trimmed;
}
```

**Pros:** Role-specific constraints
**Cons:** Another helper function
**Effort:** Small
**Risk:** Low

### Option C: Enum Validator for Predefined Roles

If roles are predefined (e.g., "Team A Captain", "Team B Captain"):
```typescript
role: v.union(
  v.literal("Team A Captain"),
  v.literal("Team B Captain"),
  // ...
)
```

**Pros:** Type-safe, prevents invalid roles entirely
**Cons:** Inflexible, requires code change for new roles
**Effort:** Medium
**Risk:** Low

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/sessions.ts` - assignPlayer mutation

## Acceptance Criteria

- [ ] Role input is trimmed
- [ ] Role has a maximum length constraint
- [ ] Empty roles are rejected

## Work Log

| Date | Action | Learning |
|------|--------|----------|
| 2026-01-14 | Created from PR #20 review | Security review identified missing validation |

## Resources

- PR #20: https://github.com/Esk3tit/wtcs-map-vote/pull/20
