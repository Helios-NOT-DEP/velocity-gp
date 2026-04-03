# npm Workspaces Without Turborepo

## Quick Summary

You can set up a monorepo with **npm workspaces** (available since npm 7) without any build orchestration. npm handles dependency linking and script execution automatically—similar to pnpm but using npm instead.

## Setup (5 minutes)

### 1. Root package.json

```json
{
  "name": "my-product",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "dev:web": "npm run dev --workspace=apps/web",
    "dev:api": "npm run dev --workspace=apps/api",
    "dev": "concurrently \"npm run dev:web\" \"npm run dev:api\"",
    "test": "npm test --workspaces",
    "lint": "npm run lint --workspaces --if-present"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

### 2. No additional files needed!

npm reads the `"workspaces"` field in root `package.json`. That's all you need.

## Running Commands

### Everyone (in dependency order)

```bash
npm run build --workspaces      # Build all
npm test --workspaces          # Test all
npm run lint --workspaces      # Lint all (skip if not present)
```

### Specific workspace

```bash
npm run build --workspace=packages/ui          # Just UI package
npm run dev --workspace=apps/api               # Just API app
npm run test --workspace=@repo/api-contract    # By package name
```

### Install dependencies everywhere

```bash
npm install    # Runs once at root, installs all packages/apps
```

### Add dependency to specific workspace

```bash
npm install lodash --workspace=packages/utils
npm install -D vitest --workspace=apps/api
```

## Dependency Resolution

npm automatically links packages in your workspace:

```typescript
// apps/web can import from packages/api-contract
import type { User } from '@repo/api-contract';

// npm resolves this to packages/api-contract/src/index.ts
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
  },
  "dependencies": {
    "@repo/api-contract": "*",
    "@repo/ui": "*"
  }
}

// apps/api/package.json
{
  "name": "@repo/api",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@repo/api-contract": "*",
    "@repo/domain": "*"
  }
}

// packages/ui/package.json
{
  "name": "@repo/ui",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  }
}
```

Root scripts delegate to these via `npm run ... --workspaces`.

## Parallel Development

Use `concurrently` to run multiple apps at once:

```bash
npm install -D concurrently

# In root package.json (already shown above)
"dev": "concurrently \"npm run dev:web\" \"npm run dev:api\""
```

Then run:

```bash
npm run dev    # Starts both web and api in parallel
```

Or run individually:

```bash
npm run dev:web     # Just web on port 5173 (by default)
npm run dev:api     # Just API on port 3000 (by default)
```

## Workspace Selection

### Run in all workspaces

```bash
npm run build --workspaces
npm test --workspaces
```

### Run in specific workspace by name

```bash
npm run build --workspace=@repo/ui
npm run dev --workspace=@repo/api
```

### Run in specific workspace by folder

```bash
npm run build --workspace=./packages/ui
npm run dev --workspace=./apps/api
```

### Run and skip missing scripts

```bash
npm run lint --workspaces --if-present  # Skips if lint script doesn't exist
```

## File Watching & Rebuilds

Configure each app/package to watch and rebuild:

```json
// packages/ui/package.json
{
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc"
  }
}

// apps/api/package.json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc"
  }
}
```

Then run all in watch mode:

```bash
npm run dev --workspaces
```

Or run specific ones:

```bash
npm run dev --workspace=packages/ui --workspace=apps/api
```

## CI/CD (Without Build Optimization)

For GitHub Actions:

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci # Clean install (respects lock file)
      - run: npm run lint --workspaces
      - run: npm run build --workspaces
      - run: npm test --workspaces
```

**Note:** Without Turborepo, builds run sequentially in dependency order (slower). Each commit triggers full rebuilds—no incremental caching.

## npm vs pnpm Workspaces Comparison

| Feature                | npm workspaces            | pnpm workspaces           |
| ---------------------- | ------------------------- | ------------------------- |
| **First released**     | npm 7 (2021)              | pnpm 4 (2019)             |
| **Disk usage**         | Higher (some duplication) | Lower (stricter linking)  |
| **Install speed**      | Moderate                  | Faster                    |
| **Bandwidth**          | Standard                  | Uses flat structure       |
| **Learning curve**     | Familiar (native)         | Slight learning curve     |
| **Community adoption** | Growing                   | Growing rapidly           |
| **Ideal for**          | Teams already on npm      | Teams wanting performance |

**Recommendation:** npm workspaces are great if your team already uses npm. No new tooling to learn.

## npm Workspaces Specifics

### How npm finds workspaces

npm checks:

1. `"workspaces"` array in root `package.json`
2. Patterns like `"apps/*"` expand to all folders in `apps/`
3. Each folder found must have a `package.json` with a `"name"` field

### Example workspace definition

```json
{
  "workspaces": [
    "apps/*", // Matches apps/web, apps/api, apps/docs
    "packages/*", // Matches packages/ui, packages/api-contract, etc.
    "!apps/old-app" // Explicitly exclude (optional)
  ]
}
```

### Verify workspace setup

```bash
npm ls --depth=0 --workspaces
```

Shows all linked packages and their locations.

## Publishing Packages from Monorepo

If you want to publish `@repo/ui` to npm registry:

```bash
cd packages/ui

# Build first
npm run build

# Update version
npm version minor

# Publish
npm publish --access=public

# Tag release
git tag packages/ui@1.2.0
git push --tags
```

Each package can have its own lifecycle and versioning.

## Common Scripts Pattern

### Root package.json

```json
{
  "scripts": {
    "install": "npm install",
    "dev": "concurrently npm:dev:*",
    "dev:web": "npm run dev --workspace=apps/web",
    "dev:api": "npm run dev --workspace=apps/api",
    "build": "npm run build --workspaces",
    "build:web": "npm run build --workspace=apps/web",
    "build:api": "npm run build --workspace=apps/api",
    "test": "npm test --workspaces",
    "test:watch": "npm test -- --watch --workspaces",
    "lint": "npm run lint --workspaces --if-present",
    "clean": "rm -rf node_modules && npm i",
    "type-check": "npm run type-check --workspaces --if-present"
  }
}
```

Then run:

```bash
npm run dev           # All dev servers
npm run build         # All builds
npm run test:watch   # Watch mode for tests
npm run lint         # Lint everything
```

## Dependency Management

### Local package dependency

```bash
npm install @repo/api-contract --workspace=apps/web
```

npm automatically resolves to the local package, not npm registry.

### Ensure local linking in package.json

```json
// apps/web/package.json
{
  "dependencies": {
    "@repo/api-contract": "*", // ← * means "latest from workspace"
    "@repo/ui": "^1.0.0" // ← Can also pin versions (still uses local)
  }
}
```

If the local package doesn't satisfy the constraint, npm warns you.

## Troubleshooting

### Package not found in workspace

```
npm ERR! peer dep missing
```

**Fix:**

1. Verify folder exists and has `package.json` with `"name"` field
2. Check workspace definition in root `package.json`
3. Run `npm install` again
4. Run `npm ls --depth=0 --workspaces` to verify

### Circular dependencies

npm doesn't enforce circular dependency rules automatically. Use a linter:

```bash
npm install -D eslint-plugin-import
```

Add rules in `.eslintrc.json`:

```json
{
  "plugins": ["import"],
  "rules": {
    "import/no-cycle": "error"
  }
}
```

### Script not found in workspace

```
npm ERR! missing script: build in workspace: @repo/ui
```

**Fix:** Add the script to `packages/ui/package.json`, or use `--if-present` flag.

## Scaling from npm Workspaces

npm workspaces scale well for:

- 3-10 packages/apps
- Infrequent builds (< 10x per day)
- Small teams (< 5 people)

For larger monorepos, consider adding **Turborepo** on top:

```bash
npm install -D turbo
```

Then create `turbo.json` and change root scripts:

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test"
  }
}
```

Everything else stays the same — npm workspaces still handle linking.

## Summary

npm workspaces give you:

- ✓ Native to npm (no extra tools)
- ✓ One install (`npm install` at root)
- ✓ Automatic linking (`import @repo/ui` just works)
- ✓ Dependency order (`npm run ... --workspaces` respects it)
- ✓ Familiar commands
- ✗ No build caching (always rebuilds)
- ✗ No remote cache support
- ✗ Sequential builds by default

Perfect for small to medium monorepos. Add Turborepo later if builds become a bottleneck.
