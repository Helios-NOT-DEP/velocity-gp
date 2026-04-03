# pnpm Workspaces Without Turborepo

## Quick Summary

You can set up a functional monorepo with just **pnpm workspaces** — Turborepo is purely optional orchestration on top. Choose pnpm-only if you value simplicity over advanced caching.

## Setup (5 minutes)

### 1. Root package.json

```json
{
  "name": "my-product",
  "private": true,
  "scripts": {
    "install": "pnpm install",
    "build": "pnpm -r build",
    "dev:web": "cd apps/web && pnpm dev",
    "dev:api": "cd apps/api && pnpm dev",
    "dev": "concurrently \"pnpm dev:web\" \"pnpm dev:api\"",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint --fix"
  },
  "devDependencies": {
    "typescript": "latest",
    "concurrently": "^8.0.0"
  }
}
```

### 2. pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 3. That's it!

No `turbo.json` needed. pnpm now understands your workspace structure.

## Running Commands

### Everyone (in dependency order)

```bash
pnpm -r build        # Build all
pnpm -r test         # Test all
pnpm -r lint         # Lint all
```

### Specific scope

```bash
pnpm --filter @repo/ui build       # Just the UI package
pnpm --filter @repo/api test       # Just the API app
pnpm --filter ./apps/web dev      # Just the web app
```

### Filtered to changed

```bash
pnpm -r --changed build   # Only apps that changed since last commit
```

## Parallel Development

Use `concurrently` to run multiple apps at once:

```bash
npm install -D concurrently

# In root package.json
"dev": "concurrently \"pnpm dev:web\" \"pnpm dev:api\""
```

Then run:

```bash
pnpm dev              # Starts both web and api
```

## Dependency Resolution

pnpm automatically links packages in your workspace:

```typescript
// apps/web can import from packages/api-contract
import type { User } from '@repo/api-contract';

// pnpm resolves this to packages/api-contract
// Works automatically — no special config needed
```

## Per-App Scripts

Each app/package has its own `package.json` with build scripts:

```json
// apps/web/package.json
{
  "name": "@repo/web",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}

// apps/api/package.json
{
  "name": "@repo/api",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "test": "vitest"
  }
}
```

Root scripts delegate to these via `pnpm -r`.

## Dependency Groups

Use `pnpm -r` with scope filtering to run different commands:

```bash
# Build only packages, skip apps
pnpm --filter "./packages/**" build

# Test only apps
pnpm --filter "./apps/**" test

# Everything except docs
pnpm --filter '!./docs' lint
```

## Common Workflows

### Install dependencies everywhere

```bash
pnpm install   # Runs once at root, installs all packages/apps
```

### Add dependency to one package

```bash
pnpm --filter @repo/ui add react
```

### Add dev dependency to root

```bash
pnpm add -D typescript --filter root
```

### Link local package to app

```bash
pnpm --filter @repo/web add @repo/ui
# pnpm automatically links to packages/ui
```

### Update all dependencies

```bash
pnpm -r up --latest
```

## File Watching & Rebuilds

To auto-rebuild packages when they change:

```bash
# In root package.json, add watch script
"watch": "pnpm -r watch"

# Each app/package defines its own watch script
// apps/web/package.json
"watch": "vite"

// apps/api/package.json
"watch": "tsx watch src/server.ts"

// packages/ui/package.json
"watch": "tsc --watch"
```

Then:

```bash
pnpm watch  # All apps/packages in watch mode
```

## CI/CD (Without Turborepo Cache)

For GitHub Actions, just run pnpm commands:

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm lint
      - run: pnpm build
      - run: pnpm test
```

Builds run sequentially (slower than Turborepo), but still in dependency order.

## Scaling to Turborepo

If you outgrow pnpm-only:

1. **Install Turbo**: `pnpm add -D turbo`
2. **Create turbo.json** at root with your pipeline
3. **Replace scripts** in package.json: `pnpm -r build` → `turbo build`
4. Everything else stays the same — pnpm workspaces still handle linking

## Comparison: pnpm-only vs Turborepo

| Scenario                | pnpm-only     | Turborepo     |
| ----------------------- | ------------- | ------------- |
| 1-3 apps                | ✓ Perfect     | Overkill      |
| 5+ apps                 | ✓ Works       | ✓ Better      |
| Frequent CI builds      | Slow rebuilds | Fast (cached) |
| First monorepo          | ✓ Simpler     | More to learn |
| Need remote cache       | No            | ✓ Yes         |
| Want incremental builds | No            | ✓ Yes         |

## Tips & Tricks

### Check workspace structure

```bash
pnpm ls --depth=-1
```

### Find what depends on a package

```bash
pnpm why @repo/ui   # Where is UI being used?
```

### Audit workspace

```bash
pnpm audit
pnpm audit --fix
```

### Clean all node_modules

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

## Summary

pnpm workspaces give you:

- ✓ One install (`pnpm install` at root)
- ✓ Automatic linking (`import @repo/ui` just works)
- ✓ Dependency order (`pnpm -r` respects it)
- ✓ Scope filtering (`--filter`)
- ✗ No caching (always rebuilds)
- ✗ No remote cache (for CI)

Good enough for small teams and projects. Graduate to Turborepo when builds become a bottleneck.
