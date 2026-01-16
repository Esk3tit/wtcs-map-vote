# Markdown URL Formatting Standards

## Problem

Bare URLs in Markdown files trigger linting warnings (MD034) and reduce readability:

```markdown
## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/21
- OWASP: https://owasp.org/Top10/A01_2021-Broken_Access_Control/
```

## Solution

Format all URLs as Markdown links with descriptive text:

```markdown
## Resources

- PR: [`#21`](https://github.com/Esk3tit/wtcs-map-vote/pull/21)
- [OWASP Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
```

## Patterns by URL Type

### GitHub PRs
```markdown
- PR: [`#123`](https://github.com/owner/repo/pull/123)
```

### GitHub Issues
```markdown
- Issue: [`#456`](https://github.com/owner/repo/issues/456)
```

### External Documentation
```markdown
- [OWASP Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [Convex Documentation](https://docs.convex.dev/)
```

### Internal References
```markdown
- See [CLAUDE.md](../../CLAUDE.md) for project guidelines
- Reference: [Pagination Best Practices](../pagination/convex-pagination-best-practices.md)
```

## Why This Matters

1. **Linting compliance**: Passes markdownlint MD034 (no-bare-urls)
2. **Readability**: Descriptive text is clearer than raw URLs
3. **Accessibility**: Screen readers can announce meaningful link text
4. **Maintainability**: Consistent format across all documentation

## Prevention

When writing Markdown documentation:
1. Never paste bare URLs - always wrap in `[text](url)` syntax
2. Use descriptive link text that indicates the destination
3. For PRs/issues, use the `#number` format in backticks for emphasis

## Related

- [markdownlint MD034](https://github.com/DavidAnson/markdownlint/blob/main/doc/md034.md)
