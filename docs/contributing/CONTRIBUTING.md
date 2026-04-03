# Contributing to Velocity GP

Thank you for your interest in contributing! This guide explains our development process, code standards, and how to get your work merged.

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

## Getting Started

1. **Fork & Clone**: Fork the repo and clone your fork locally
2. **Read Docs**: Familiarize yourself with:
   - [DEVELOPMENT.md](../DEVELOPMENT.md) — Setup & conventions
   - [docs/product/Velocity%20GP%20BDD%20Specifications.md](../product/Velocity%20GP%20BDD%20Specifications.md) — Product requirements
   - [docs/architecture/Tech%20Stack%20Needed.md](../architecture/Tech%20Stack%20Needed.md) — Architecture & stack
3. **Create a Branch**: Use clear naming: `feat/`, `fix/`, `docs/`, `refactor/`
4. **Make Changes**: Follow conventions below
5. **Test**: Run `npm run build` and manual smoke tests
6. **Commit**: Use conventional commit messages
7. **Push & PR**: Open a pull request with clear description

## Commit Message Format

Use conventional commits for clarity:

```
feat: add player profile page
fix: correct hazard penalty calculation
docs: update DEVELOPMENT guide
refactor: reorganize service layer
chore: update dependencies
```

**Format**: `<type>: <subject>`

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `refactor` | Code structure (no behavior change) |
| `chore` | Dependencies, config |
| `test` | Test additions/updates |

## Code Style

### TypeScript & React

- **Functional components** (no class components)
- **Hooks** for state and side effects
- **Single quotes** in `.ts` and `.tsx`: `'hello'` not `"hello"`
- **Semicolons** required at end of statements
- **PascalCase** for components: `PlayerProfile.tsx`
- **camelCase** for functions and variables: `fetchRaceState()`

### Styling

- **Tailwind CSS** for all styling (no inline styles or CSS-in-JS)
- **Responsive first**: mobile → tablet → desktop
- Reference `apps/web/src/styles/theme.css` for design tokens
- Reuse UI primitives from `packages/ui/src/components/`

### Files & Organization

```
✅ Good:
- RaceHub.tsx (page component)
- raceLogic.ts (utility functions)
- useRaceState.ts (custom hook)
- race.ts (domain model)

❌ Avoid:
- RaceLogic.ts (function files lowercase)
- useRace.ts without clear purpose
- Scattered types (consolidate to packages/api-contract/src/)
```

## Testing

Add tests for:
- ✅ Utility functions
- ✅ Service logic
- ✅ Custom hooks
- ✅ Complex components
- ❌ Skip: simple presentational components, implementation details

Run tests before committing:

```bash
npm test
npm run build  # Verify production build
```

## Pull Request Checklist

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Tests added/updated (if applicable)
- [ ] Documentation updated (if applicable)
- [ ] Conventional commit messages used
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] Screenshots included (for UI changes)

## Review Process

1. **Automated**: GitHub Actions runs linting and build
2. **Manual**: Team member reviews code
3. **Feedback**: Respond to comments constructively
4. **Merge**: Squash commits to keep history clean

## Reporting Issues

When filing a bug report, include:

```
**Describe the bug**
Clear, concise description.

**Steps to reproduce**
1. Go to…
2. Click…
3. See error…

**Expected behavior**
What should happen.

**Screenshots/Video**
Visual proof of the issue.

**Environment**
- OS: Windows / macOS / Linux
- Node version: (node --version)
- npm version: (npm --version)
```

## Feature Requests

Describe:
- **Use case**: Why is this needed?
- **Proposed solution**: How should it work?
- **Alternatives**: Other approaches considered?
- **Reference**: Link to BDD spec or GitHub issue if applicable

## Documentation

Update docs when:
- Adding new features
- Changing architecture or structure
- Introducing new tooling
- Clarifying existing functionality

Key docs to update:
- [DEVELOPMENT.md](../DEVELOPMENT.md) — Setup & conventions
- Inline code comments for complex logic
- [docs/](../) — Architectural decisions or major changes

## Performance & Best Practices

- ✅ Use React DevTools Profiler to check for unnecessary renders
- ✅ Lazy load pages and heavy components
- ✅ Memoize expensive calculations
- ✅ Test builds run under 60 seconds
- ❌ Avoid: 3rd party analytics without approval
- ❌ Avoid: Hardcoding config values (use env vars)

## Getting Help

- 💬 GitHub Discussions for questions
- 🐛 GitHub Issues for bugs
- 📖 Check [DEVELOPMENT.md](../DEVELOPMENT.md)
- 🎨 Review [Figma Design Prompt](../design/Figma%20Design%20Prompt.md)

---

We appreciate your contributions! 🚀
