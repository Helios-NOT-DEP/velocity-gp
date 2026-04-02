---
name: monorepo-structure
description: 'Design and structure a React + TypeScript fullstack monorepo with pnpm and Turborepo. Use when planning a new monorepo, organizing apps and packages, setting up dependency rules, configuring Prisma for shared schemas, or auditing existing monorepo structure. Triggers: "monorepo structure", "fullstack", "pnpm workspaces", "Turborepo", "apps packages separation", "shared contracts", "API architecture".'
argument-hint: 'Describe your project scope (personal/team/scale) and key apps (web, API, etc.)'
---

# React + TypeScript Fullstack Monorepo Structure

## When to Use

- Planning a new fullstack project with shared frontend/backend code
- Organizing multiple deployable apps alongside reusable packages
- Setting up TypeScript contracts and utilities shared across the stack
- Configuring Prisma ORM with schema shared via packages
- Auditing or restructuring an existing monorepo

## Key Principles

1. **Deployment Units vs Modules**: `apps/*` are deployable; `packages/*` are reusable modules
2. **Clean Boundaries**: Packages never depend on `apps/*`; apps depend on packages
3. **Shared Contracts**: API contracts, validation schemas, and DTOs live in dedicated packages
4. **Framework Agnostic Cores**: Domain logic and utilities stay independent of frameworks
5. **One Install, Multiple Outputs**: pnpm workspaces + Turborepo enable fast parallel builds

## Recommended Architecture

### The Complete Tree

```
my-product/
├─ apps/
│  ├─ web/                        # React app (Vite)
│  │  ├─ public/
│  │  ├─ src/
│  │  │  ├─ app/                  # app shell, routes, providers
│  │  │  ├─ features/             # feature modules: auth, dashboard, etc.
│  │  │  ├─ components/           # app-specific React components
│  │  │  ├─ hooks/                # app-specific custom hooks
│  │  │  ├─ lib/                  # web-only helpers, utils
│  │  │  ├─ api/                  # calls into api-client package
│  │  │  ├─ styles/
│  │  │  ├─ types/                # web-only local types
│  │  │  ├─ main.tsx
│  │  │  └─ env.d.ts
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ vite.config.ts
│  │
│  ├─ api/                        # Backend / BFF
│  │  ├─ src/
│  │  │  ├─ server.ts             # bootstrap
│  │  │  ├─ app.ts                # app wiring
│  │  │  ├─ routes/               # route handlers
│  │  │  ├─ services/             # business logic
│  │  │  ├─ repositories/         # data access layer
│  │  │  ├─ middleware/           # Express/Fastify middleware
│  │  │  ├─ lib/                  # shared helpers
│  │  │  ├─ config/               # env, settings
│  │  │  ├─ jobs/                 # background jobs, queues
│  │  │  ├─ db/
│  │  │  │  ├─ schema.prisma      # ← Prisma schema lives here
│  │  │  │  ├─ migrations/        # ← Prisma migrations
│  │  │  │  ├─ seed.ts
│  │  │  │  └─ client.ts
│  │  │  └─ tests/
│  │  ├─ .env.local
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ dockerfile
│  │
│  └─ docs/                       # optional Storybook, design system
│     ├─ src/
│     └─ package.json
│
├─ packages/
│  ├─ ui/                         # Shared React component library
│  │  ├─ src/
│  │  │  ├─ components/
│  │  │  ├─ hooks/
│  │  │  ├─ styles/
│  │  │  └─ index.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ api-contract/               # ← Prisma types imported here
│  │  ├─ src/
│  │  │  ├─ auth.ts               # Auth DTOs, Zod schemas
│  │  │  ├─ users.ts              # User DTOs, Zod schemas
│  │  │  ├─ entities.ts           # Exported Prisma types
│  │  │  └─ index.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ api-client/                 # Typed HTTP client
│  │  ├─ src/
│  │  │  ├─ client.ts             # HTTP client setup
│  │  │  ├─ auth.ts
│  │  │  ├─ users.ts
│  │  │  └─ index.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ domain/                     # Pure business logic
│  │  ├─ src/
│  │  │  ├─ auth/
│  │  │  ├─ billing/
│  │  │  └─ index.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ utils/                      # Framework-agnostic TS helpers
│  │  ├─ src/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ config-typescript/          # Shared tsconfig presets
│  │  ├─ base.json
│  │  ├─ react.json
│  │  ├─ node.json
│  │  └─ package.json
│  │
│  ├─ config-eslint/              # Shared lint config
│  │  ├─ index.js
│  │  └─ package.json
│  │
│  └─ config-vitest/              # Shared test config
│     ├─ index.ts
│     └─ package.json
│
├─ infra/                         # IaC, Docker, k8s, Terraform
│  ├─ docker/
│  ├─ k8s/
│  └─ terraform/
│
├─ .github/
│  └─ workflows/
│
├─ package.json                   # root scripts
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.json
├─ .env.example
├─ .gitignore
└─ README.md
```

### Minimal Version (Good Starting Point)

If you're starting small, this core subset preserves monorepo benefits:

```
repo/
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  ├─ ui/
│  ├─ api-contract/
│  ├─ api-client/
│  └─ config-typescript/
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json          # or skip this for pnpm-only setup
```

The `turbo.json` is optional — if you skip it, just use `pnpm -r` commands instead.

## Clean Dependency Rules

### Import Flow (What Can Depend on What)

- **apps/web** → `packages/ui`, `packages/api-client`, `packages/api-contract`
- **apps/api** → `packages/api-contract`, `packages/domain`, `packages/utils`
- **packages/api-client** → `packages/api-contract`
- **packages/domain** → `packages/utils` only (stays framework-agnostic)
- **packages/ui** → No backend packages (stays frontend-only)
- **Packages must NOT import from `apps/*`** (reverse dependency)

### Common Anti-Pattern

```javascript
// ❌ WRONG: app importing from another app
import { userAPI } from '@repo/api'; // app -> app

// ✓ CORRECT: share via package
import { UserDTO } from '@repo/api-contract';
```

## Prisma ORM Integration

Prisma schema lives in `apps/api/src/db/schema.prisma`, but types are exported via `packages/api-contract` for reuse.

### Setup Steps

1. **Initialize Prisma in apps/api**:

   ```bash
   cd apps/api
   pnpm prisma init
   ```

2. **Configure .env.local in apps/api**:

   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/myapp"
   ```

3. **Update apps/api/src/db/client.ts**:

   ```typescript
   import { PrismaClient } from '@prisma/client';

   export const db = new PrismaClient();
   ```

4. **Export types from packages/api-contract/src/entities.ts**:

   ```typescript
   // Re-export Prisma-generated types for frontend/other packages
   export type { User, Team, Game } from '@prisma/client';
   export * as Prisma from '@prisma/client';
   ```

5. **Consume in apps/web or other packages**:
   ```typescript
   import type { User } from '@repo/api-contract';
   ```

### Key Principles

- **Schema lives in API**: `apps/api/src/db/schema.prisma`
- **Migrations live in API**: `apps/api/src/db/migrations/`
- **Types exported via contract package**: Frontend never directly imports from Prisma client
- **Use DTO packages**: Create simplified request/response shapes in `api-contract`, don't expose ORM entities directly
- **Connection pooling for serverless**: Use Prisma Data Proxy or PgBouncer in production

## Tooling Setup

### Root package.json (pnpm workspaces)

```json
{
  "name": "my-product",
  "version": "0.0.1",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "latest"
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### turbo.json

```json
{
  "$schema": "https://turborepo.org/schema.json",
  "globalDependencies": ["package.json", "tsconfig.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "dev": {
      "cache": false
    }
  }
}
```

## Alternative Setups (Without Turborepo)

You can use either **npm workspaces** or **pnpm workspaces** without any build orchestrator. Both handle dependency linking and script execution automatically.

### Option 1: npm Workspaces (Native, No Extra Tools)

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
    "concurrently": "latest"
  }
}
```

**Key Commands:**

- `npm run build --workspaces` — Build all
- `npm test --workspaces` — Test all
- `npm run build --workspace=packages/ui` — Build specific package
- `npm install` — One install at root, automatic linking

See [npm-only.md](./references/npm-only.md) for complete guide.

### Option 2: pnpm Workspaces (Higher Performance)

### Root package.json (pnpm-only)

```json
{
  "name": "my-product",
  "version": "0.0.1",
  "scripts": {
    "build": "pnpm -r build",
    "dev:web": "cd apps/web && pnpm dev",
    "dev:api": "cd apps/api && pnpm dev",
    "dev": "concurrently \"pnpm dev:web\" \"pnpm dev:api\"",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "latest",
    "concurrently": "latest"
  }
}
```

**Key Commands:**

- `pnpm -r build` — Build all packages/apps in dependency order
- `pnpm -r test` — Run tests in all packages/apps
- `pnpm --filter @repo/ui build` — Build only the UI package
- `concurrently` — Run dev servers in parallel (install optional)

### Comparison: npm vs pnpm vs Turborepo

| Feature                | npm workspaces | pnpm workspaces | Turborepo + pnpm  |
| ---------------------- | -------------- | --------------- | ----------------- |
| **Setup time**         | 5 min (native) | 5 min (install) | 10 min            |
| **Dependency linking** | ✓ Yes          | ✓ Yes           | ✓ Yes             |
| **Parallel builds**    | ✗ Sequential   | ✗ Sequential    | ✓ Automatic       |
| **Build caching**      | ✗ No           | ✗ No            | ✓ Yes             |
| **Remote cache**       | ✗ No           | ✗ No            | ✓ Yes (CI/CD)     |
| **Disk usage**         | Higher         | Lower           | Lower             |
| **Install speed**      | Moderate       | Faster          | Faster            |
| **Learning curve**     | ✓ Minimal      | Slight          | Moderate          |
| **Good for**           | npm teams      | Performance     | Growing monorepos |

**Quick decision guide:**

- **npm workspaces**: Already using npm, want zero new tools, < 5 apps
- **pnpm workspaces**: Want better performance and disk usage, < 5 apps
- **Turborepo**: Frequently rebuilding, > 5 apps, CI/CD bottleneck

See [npm-only.md](./references/npm-only.md), [pnpm-only.md](./references/pnpm-only.md), or continue to the Turborepo section above.

---

## Feature Organization (Inside Apps)

### React Frontend (apps/web)

Group by feature, not by type:

```
src/
├─ app/                    # Global providers, router setup
├─ features/
│  ├─ auth/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ services/
│  │  └─ index.ts
│  ├─ dashboard/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  └─ index.ts
│  └─ billing/
│     ├─ components/
│     └─ index.ts
├─ shared/                 # Cross-app components, hooks
└─ lib/
   └─ (web-only helpers)
```

### Backend API (apps/api)

Layered by responsibility:

```
src/
├─ routes/           # Express/Fastify route definitions
├─ services/         # Business logic
├─ repositories/     # Data access (queries)
├─ middleware/       # Request/response handling
├─ lib/              # Shared helpers
└─ config/           # Settings, env validation
```

## Common Naming Pitfalls

| ❌ Anti-pattern   | ✓ Better                                                           |
| ----------------- | ------------------------------------------------------------------ |
| `packages/types`  | `packages/api-contract` (explicit: contains contracts)             |
| `packages/shared` | `packages/domain` or `packages/utils` (semantic: what does it do?) |
| `apps/backend`    | `apps/api` or `apps/bff` (if it's a BFF, be explicit)              |
| `apps/frontend`   | `apps/web` (specific platform)                                     |

If your backend is truly a Backend-for-Frontend (BFF), name it `bff/` to discourage it from growing into a generic backend. This boundary makes intent explicit.

## Next Steps

1. **Initialize tooling**: `pnpm init`, `turbo init`
2. **Set up shared config packages**: TypeScript, ESLint, Vitest configs
3. **Establish tsconfig hierarchy**: Shared base, per-app extensions
4. **Add scripts**: Build, dev, test, lint at root via Turborepo
5. **Set up CI/CD**: Use `turbo` in GitHub Actions or CI platform
6. **Configure Prisma**: Initialize in API app, export types via contract package

See [Monorepo.tools TypeScript guide](https://monorepo.tools/typescript) and [Turborepo docs](https://turbo.build/repo/docs) for deeper dives.
