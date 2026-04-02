# Monorepo Best Practices & Anti-Patterns

## Golden Rules

| ✓ DO                                             | ❌ DON'T                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Group by feature inside apps                     | Flat global `components/`, `hooks/`, `utils/`                    |
| Keep packages small and focused (< 500 LOC each) | Create mega-packages that do everything                          |
| Export public APIs via `index.ts`                | Import deep from package internals: `@repo/ui/components/Button` |
| Use shared TypeScript configs                    | Have every app with different `tsconfig.json`                    |
| Run same linting rules everywhere                | Let each app have custom ESLint rules                            |
| Document dependency rules in README              | Let dependencies organically grow                                |
| Use Turborepo for orchestration                  | Run scripts manually across apps                                 |
| Keep domain logic framework-agnostic             | Write business logic as React hooks                              |

## Package Dependencies Best Practices

### ✓ Healthy Dependency Tree

```
apps/web
  ├─→ @repo/ui
  ├─→ @repo/api-client
  ├─→ @repo/api-contract
  └─→ @repo/domain

@repo/api-client
  └─→ @repo/api-contract

@repo/domain
  └─→ @repo/utils

@repo/ui
  └─ (no dependencies on packages)
```

### ❌ Circular Dependencies (Anti-Pattern)

```
# BAD: Circular import
@repo/api-contract
  ├─→ @repo/api-client
         └─→ @repo/api-contract  ← CIRCULAR!
```

**Prevention**:

- Never import service/client packages in contract packages
- Contracts are data-only (types, schemas, enums)

### ❌ Building Giant Monolith (Anti-Pattern)

```
# BAD: Everything in one package
@repo/shared
  ├─ all UI components
  ├─ all business logic
  ├─ all utilities
  ├─ all types
  └─ all configurations
```

**Better**: Split into focused packages with clear purposes

## Testing Architecture

### Unit Tests (Each Package)

```
packages/domain/
  ├─ src/
  │  └─ auth/
  │     ├─ auth.ts
  │     └─ auth.test.ts
  └─ vitest.config.ts
```

### Integration Tests (API App)

```
apps/api/
  ├─ src/
  │  └─ routes/
  │     ├─ users.ts
  │     └─ users.test.ts  # Tests API + service + repository
  └─ vitest.config.ts
```

### E2E Tests (Web App)

```
apps/web/
  ├─ e2e/
  │  ├─ auth.spec.ts
  │  └─ dashboard.spec.ts
  └─ playwright.config.ts
```

### Shared Test Config

```
packages/config-vitest/index.ts
  ├─ Common setup
  ├─ Global mocks
  └─ Custom matchers
```

## File Organization Principles

### Feature-Based Structure (✓ Recommended)

```
src/
├─ features/
│  ├─ auth/
│  │  ├─ components/
│  │  │  ├─ LoginForm.tsx
│  │  │  └─ AuthGuard.tsx
│  │  ├─ hooks/
│  │  │  └─ useAuth.ts
│  │  ├─ services/
│  │  │  └─ authService.ts
│  │  └─ index.ts
│  ├─ dashboard/
│  │  ├─ components/
│  │  ├─ pages/
│  │  └─ index.ts
│  └─ settings/
│     └─ ...
├─ shared/
│  ├─ components/
│  │  ├─ Header.tsx
│  │  ├─ Sidebar.tsx
│  │  └─ Footer.tsx
│  ├─ hooks/
│  │  └─ useResponsive.ts
│  └─ lib/
│     └─ helpers.ts
└─ app/
   ├─ App.tsx
   ├─ routes.ts
   └─ providers.tsx
```

**Benefits:**

- Easy to delete/move entire features
- All related code lives together
- New contributors know where to add code
- Scales naturally as features grow

### Type-Based Structure (❌ Creates Chaos)

```
src/
├─ components/     # Everything mixes here
├─ hooks/          # Hard to find related code
├─ services/       # Services for all features
├─ pages/          # Pages don't reflect features
└─ utils/          # Misc helpers (12 files?)
```

**Problems:**

- Hard to find related code
- Merging features requires cross-directory changes
- Discourages code reuse (buried in utils)

## Environment Variables

### Monorepo Env Strategy

**Root `.env.example`** (committed):

```
# Shared across all apps
NODE_ENV=development
LOG_LEVEL=debug

# App-specific (document what each app needs)
# apps/api
DATABASE_URL=postgresql://...
JWT_SECRET=...

# apps/web
VITE_API_URL=http://localhost:3000
VITE_ANALYTICS_KEY=...
```

**App-specific `.env.local`** (gitignored):

```
# apps/api/.env.local (never commit)
DATABASE_URL="postgresql://user:pass@localhost:5432/myapp"
```

**Load in code:**

Frontend (Vite):

```typescript
// apps/web/src/config.ts
export const apiUrl = import.meta.env.VITE_API_URL;
```

Backend:

```typescript
// apps/api/src/config/env.ts
export const dbUrl = process.env.DATABASE_URL;
```

## Monorepo vs Separate Repos Decision Matrix

| Scenario                                                 | Monorepo            | Separate       |
| -------------------------------------------------------- | ------------------- | -------------- |
| **Frontend & backend always ship together**              | ✓ YES               | ✗ No           |
| **Shared business logic**                                | ✓ YES               | ✗ No           |
| **Separate deployment cadences (FE weekly, BE monthly)** | ✗ No                | ✓ YES          |
| **Different teams own parts**                            | ✓ YES (with policy) | ✓ YES (easier) |
| **3+ unrelated projects**                                | ✗ No                | ✓ YES          |
| **Learning TypeScript monorepos**                        | ✓ YES (start here)  | Later          |

## Debugging Slow Builds

### 1. Profile Turbo

```bash
turbo build --profile=profile.json
# Analyze profile online: https://turbo.build/profiles
```

### 2. Check Cache Hits

```bash
turbo build --verbose  # See CACHE HIT vs CACHE MISS
```

### 3. Identify Slow Tasks

```bash
turbo build --summarize
```

### 4. Optimize

- **Move task earlier** (if dependencies allow)
- **Add outputs** to enable caching
- **Split packages** (too much in one package)
- **Use persistent tasks** for `dev` (don't rebuild on change)

## Shared Utilities Package

### What Goes In (✓)

```typescript
// packages/utils/src/
├─ math.ts           // Pure functions
├─ string.ts         // Helpers: capitalize, slugify, etc.
├─ validation.ts     // Format validators
├─ formats.ts        // Date, number formatting
├─ errors.ts         // Custom error classes
└─ index.ts
```

### What Stays Out (❌)

```typescript
// DON'T put in packages/utils:
- React hooks (goes in @repo/ui)
- API client logic (goes in @repo/api-client)
- Database queries (stays in @repo/api)
- Feature-specific helpers (stays in apps/*/features/*)
```

## Naming Consistency

### Packages

Use consistent naming across monorepo:

```
✓ Good naming:
- @repo/api-contract
- @repo/api-client
- @repo/ui
- @repo/domain
- @repo/utils

✗ Inconsistent:
- @repo/contract
- @repo/client
- @repo/components  ← Ambiguous (frontend? shared?)
- repos/business-logic
- @repo/shared  ← What's in it?
```

### Apps

```
✓ Clear:
- apps/web        (what users see)
- apps/api        (backend)
- apps/admin      (separate frontend)
- apps/docs       (documentation site)

✗ Vague:
- apps/frontend
- apps/backend
- apps/app
```

## Performance Optimization

### 1. Lazy Load Packages Only When Needed

```typescript
// ✓ GOOD: Import only what's needed
import { Button } from '@repo/ui';

// ❌ AVOID: Re-exporting everything
export * from '@repo/ui'; // Pulls in entire library
```

### 2. Tree-Shaking Friendly Exports

```typescript
// packages/utils/src/index.ts

// ✓ Named exports (tree-shakeable)
export { formatDate } from './formats';
export { validateEmail } from './validation';

// ❌ Avoid barrel re-exports
export * from './formats';
export * from './validation';
```

### 3. Limit Package Build Artifacts

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

## CI/CD Optimization

### GitHub Actions Example

```yaml
name: Build & Test
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm turbo build # Runs all builds in parallel
      - run: pnpm turbo test # Runs all tests in parallel
      - run: pnpm turbo lint # Runs all linters in parallel
```

This runs all tasks for all packages in parallel, using Turbo's caching across CI runs.
