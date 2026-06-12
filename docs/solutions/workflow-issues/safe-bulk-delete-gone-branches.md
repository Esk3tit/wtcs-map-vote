---
title: Safely Bulk-Deleting Local Branches Whose Remote Is Gone
date: 2026-06-12
category: docs/solutions/workflow-issues
module: git repository maintenance
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - Cleaning up many stale local branches after PRs have merged
  - "Local branches show `: gone]` in `git branch -vv` after fetch --prune"
  - The repository squash-merges (or rebase-merges) pull requests
tags: [git, branch-cleanup, squash-merge, gone-branches, data-loss, worktree]
---

# Safely Bulk-Deleting Local Branches Whose Remote Is Gone

## Context

A long-lived repo accumulated ~98 local branches whose remote tracking branch had been deleted (every merged PR auto-deleted its head branch on GitHub). The goal was to bulk-delete them to get back to a clean `main` **without** losing any local-only work. The trap: this repo squash-merges PRs, which makes the two obvious "is it safe?" signals both lie.

## Guidance

Do not use `git branch -d` (refuses unmerged) **or** a git-ancestry check (`git merge-base --is-ancestor <branch> origin/main`) as the safety signal in a squash-merge repo. Squash-merge collapses a branch's commits into a single *new* commit on `main`, so the branch's original commits are **not** ancestors of `main` and never patch-match. Both signals therefore flag every squash-merged branch as "unmerged," tempting you into a blanket `git branch -D` — which would also force-delete any genuinely-unmerged branch with local-only commits.

Use this two-part rule instead — a gone branch's work is preserved on the remote if **either** holds:

1. **Reachable from `origin/main`** — `git merge-base --is-ancestor <branch> origin/main` exits 0 (true merge / fast-forward).
2. **Has a MERGED PR** — its `headRefName` matches a PR whose state is `MERGED` (squash-merged; the diff lives on `main` as the squash commit).

Anything that is **closed-without-merge** or has **no PR at all** is a real data-loss candidate — exclude it and review by hand.

Procedure:

```bash
git fetch --prune
# 1. List gone branches
git branch -vv | grep ': gone]' | sed -E 's/^[*+ ]+//; s/ .*//' > /tmp/gone.txt
# 2. Pull every PR's head + merge state in ONE call (not one gh call per branch)
gh pr list --state all --limit 1000 --json number,headRefName,state,mergedAt > /tmp/prs.json
# 3. Classify each branch; only delete the verified-safe ones
while IFS= read -r b; do
  if git merge-base --is-ancestor "$b" origin/main 2>/dev/null; then
    git branch -D "$b"                       # reachable from main
  elif jq -e --arg h "$b" 'any(.[]; .headRefName==$h and .mergedAt!=null)' /tmp/prs.json >/dev/null; then
    git branch -D "$b"                       # squash-merged PR
  else
    echo "REVIEW (no merged PR, possible local-only work): $b"
  fi
done < /tmp/gone.txt
```

`git branch -D` prints `Deleted branch X (was <sha>)` — capture that output to a log; the SHA stays recoverable via `git reflog` for ~90 days. Remove any associated worktree first (`git worktree remove <path>`) before deleting its branch.

## Why This Matters

The naive paths each fail in a way that looks confident: `git branch -d` refuses *everything* (so you reach for `-D` and lose the safety net), while `--is-ancestor` reports *everything* as unmerged (so a "verification" pass green-lights a blanket force-delete). Checking PR merge state is the signal that actually tracks whether the work reached the remote, because it survives the squash. The whole point of the exercise — "make sure we're not deleting branches with data that isn't on the remote" — is only answerable at the PR layer, not the commit-graph layer.

## When to Apply

- Bulk branch cleanup in any repo that squash-merges or rebase-merges PRs (GitHub's default "Squash and merge").
- Any time `git branch -d` refuses a branch you believe was merged — that refusal is expected under squash-merge and is **not** evidence of unmerged work.

## Examples

Classification output from the real run (98 gone branches): 94 reachable from `origin/main`, 2 squash-merged (merged PR), 2 leftover review-checkouts with 0 unique commits — **0 at data-loss risk**. A pure `--is-ancestor` check would have reported the 2 squash-merged ones as "unmerged" and a pure `git branch -d` would have refused all 96, both obscuring the real answer.

## Related

- No automated mechanism deletes these for you; `git fetch --prune` only prunes the remote-tracking ref, never the local branch.
