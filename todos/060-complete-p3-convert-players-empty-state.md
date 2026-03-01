---
status: complete
priority: p3
issue_id: "060"
tags: [code-review, consistency]
dependencies: []
---

# Convert "No players assigned" empty state to shared component

## Problem Statement

The session detail page has a "No players assigned yet" inline empty state (~line 863) that was not converted to use the shared EmptyState component, despite two other card-level empty states in the same file being converted. This leaves an inconsistency.

## Findings

- `src/routes/admin/session.$sessionId.tsx:~863` — inline flex/icon/text block
- Same file has 2 other card empty states that WERE converted
- Agent: pattern-recognition, architecture-strategist

## Proposed Solutions

### Option A: Convert to EmptyState variant="card"
- Replace inline block with `<EmptyState variant="card" icon={<User className="w-12 h-12" />} title="No players assigned" description="Players will appear here once assigned" />`
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Players empty state uses shared EmptyState component

## Resources

- PR: #89
