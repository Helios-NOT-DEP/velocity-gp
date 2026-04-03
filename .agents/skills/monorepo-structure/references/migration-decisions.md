# Monorepo Migration & Common Decisions

## Migrating from Single-App to Monorepo

If you're moving from a single app to monorepo structure:

### Phase 1: Extract Shared Code

1. **Identify reusable packages**:
   - UI components → `packages/ui`
   - Domain logic → `packages/domain`
   - Common utilities → `packages/utils`
   - API contracts → `packages/api-contract`

2. **Create packages** with minimal scope (start small)

3. **Update imports** in existing app to use local packages

### Phase 2: Separate Frontend & Backend

1. **Move frontend to `apps/web`**
2. **Move backend to `apps/api`**
3. **Update root tooling** (pnpm workspaces, Turborepo)
4. **Configure shared configs** (TypeScript, ESLint, Vitest)

### Phase 3: Establish Boundaries

1. **Document dependency rules** in README
2. **Add linting rules** (eslint-plugin-import) to prevent reverse deps
3. **Set up CI checks** to validate structure

## Choosing Between BFF vs Generic Backend

| Aspect                   | BFF (Backend-for-Frontend)                                 | Generic Backend                                    |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| **Purpose**              | Serves only web; optimized for web flows                   | Multiple clients (web, mobile, desktop, 3rd-party) |
| **Data format**          | Exactly what web needs; pagination, filtering tuned for UI | Flexible, versioned APIs for multiple clients      |
| **Location in monorepo** | `apps/bff/`                                                | `apps/api/`                                        |
| **Package deps**         | `api-contract`, `domain`, web-specific utilities           | `api-contract`, `domain`, all utilities            |
| **N+1 risk**             | Lower (web controls requests)                              | Higher (need aggregation endpoints)                |

**Recommendation**: If you have only web + a single API concept, name it `bff/` and be prepared to extract a generic `api/` later if mobile is needed.

## Turbo Configuration Patterns

### Basic Cache Setup

```json
{
  "globalDependencies": ["**/.env/**", "package-lock.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "outputs": ["coverage/**"],
      "cache": true
    }
  }
}
```

### Remote Caching (CI/CD)

```json
{
  "remoteCache": {
    "enabled": true
  }
}
```

Enable with: `TURBO_TOKEN=xxx TURBO_TEAM=yyy turbo build`

## pnpm Workspace Tips

### Force Monorepo Resolution

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'

# Prevent external package confusion
nohoist:
  - 'next/**'
```

### Dependency Mismatch

If `pnpm install` complains about version conflicts:

```yaml
# pnpm-workspace.yaml
overrides:
  lodash: ^4.17.21
```

### Link Packages

For rapid iteration on shared packages:

```bash
# Make @repo/api-contract always reflect file changes
cd packages/api-contract
pnpm link --global
cd ../..
pnpm link --global @repo/api-contract
```

## TypeScript Configuration Hierarchy

### Base Config (packages/config-typescript/base.json)

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "declaration": true
  }
}
```

### React Config (packages/config-typescript/react.json)

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "target": "ES2020"
  }
}
```

### Node Config (packages/config-typescript/node.json)

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "target": "ES2022"
  }
}
```

### App-Level Config (apps/web/tsconfig.json)

```json
{
  "extends": "@repo/config-typescript/react.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## ESLint Shared Config Pattern

### Shared Config Package (packages/config-eslint)

```javascript
// packages/config-eslint/index.js
module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
  },
};
```

### App Using Shared Config (apps/web/.eslintrc.js)

```javascript
module.exports = {
  extends: ['@repo/config-eslint'],
  parserOptions: {
    project: './tsconfig.json',
  },
};
```

## Import Alias Strategies

### @repo/\* Pattern (Recommended)

```typescript
// tsconfig.json (root)
{
  "paths": {
    "@repo/*": ["packages/*/src"]
  }
}

// Usage
import { Button } from '@repo/ui';
import type { User } from '@repo/api-contract';
```

### Workspace Name Pattern

```json
{
  "paths": {
    "ui/*": ["packages/ui/src/*"],
    "api-contract/*": ["packages/api-contract/src/*"]
  }
}
```

## When to Split Monorepo

Consider multi-repo if:

1. **Different deployment schedules**: Frontend deploys daily, backend quarterly
2. **Different teams**: Different orgs owning different parts
3. **Different languages**: Backend in Python, frontend in TS (separate monorepos for each)
4. **Different governance**: Separate code review/release policies

Otherwise, **keep as monorepo** for:

- Easier refactoring across boundaries
- Single version of truth for shared code
- Coordinated releases
- Faster CI (shared cache)

## Troubleshooting

### TypeScript Can't Find Module

```
Cannot find module '@repo/ui'
```

**Checklist:**

1. Is the package listed in `pnpm-workspace.yaml`?
2. Does the package have an `index.ts` that exports?
3. Is `tsconfig.json` paths configured?
4. Try `pnpm install` then restart TS server

### pnpm Circle Dependency Error

```
Circular dependency detected
```

**Solution:**

1. Check imports in packages (should not import from each other unless needed)
2. Use `pnpm ls` to visualize dependency tree
3. Explicitly define `dependsOn` in Turbo config

### Turbo Cache Miss

```
 cache restore failed
```

**Causes:**

- Environment variable changed (update `globalDependencies`)
- Output path changed (update `outputs` in turbo.json)
- Git state mismatch (commit all files)

**Fix:**

```bash
turbo build --force  # Bypass cache
```
