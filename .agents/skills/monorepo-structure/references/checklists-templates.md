# Implementation Checklists & Templates

## New Monorepo Setup Checklist

### Phase 1: Initialization (30 min)

- [ ] Create root directory: `mkdir my-product && cd my-product`
- [ ] Initialize git: `git init`
- [ ] Initialize pnpm workspaces: `pnpm init`
- [ ] Create `pnpm-workspace.yaml`
- [ ] Create `turbo.json`
- [ ] Create `.github/` folder
- [ ] Create `apps/` and `packages/` directories
- [ ] Create root `.gitignore`
- [ ] Create root `tsconfig.json`
- [ ] Initialize root `.env.example`

### Phase 2: Shared Config Packages (1 hour)

- [ ] Create `packages/config-typescript/`
  - [ ] `base.json`, `react.json`, `node.json`
  - [ ] `package.json` with `version: "0.0.1"`
- [ ] Create `packages/config-eslint/`
  - [ ] `index.js` with shared rules
  - [ ] `package.json`
- [ ] Create `packages/config-vitest/`
  - [ ] `index.ts` with shared setup
  - [ ] `package.json`

### Phase 3: Shared Code Packages (1-2 hours)

- [ ] Create `packages/utils/`
- [ ] Create `packages/domain/`
- [ ] Create `packages/api-contract/`
  - [ ] Add Zod for schema validation
  - [ ] Add placeholder DTOs

### Phase 4: Apps (1-2 hours)

- [ ] Create `apps/web/` (React + Vite)
  - [ ] Install React, React Router, Vite
  - [ ] Configure `tsconfig.json` extending shared config
- [ ] Create `apps/api/` (Node.js backend)
  - [ ] Install Express (or Fastify)
  - [ ] Initialize Prisma: `pnpm prisma init`
  - [ ] Create `src/db/schema.prisma`
  - [ ] Create `src/db/client.ts`
  - [ ] Configure `tsconfig.json`

### Phase 5: Root Tooling (30 min)

- [ ] Update root `package.json` with scripts
- [ ] Configure Turbo cache (remote if using CI)
- [ ] Add ESLint rule to prevent circular deps
- [ ] Create `CONTRIBUTING.md` with monorepo guidelines

---

## Quick Start: Minimal Monorepo (pnpm + TypeScript)

### Step 1: Create Structure

```bash
mkdir my-fullstack && cd my-fullstack

mkdir -p apps/web
mkdir -p apps/api
mkdir -p packages/ui
mkdir -p packages/api-contract
mkdir -p packages/utils

touch pnpm-workspace.yaml
touch turbo.json
touch tsconfig.json
touch package.json
touch .gitignore
```

### Step 2: pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Step 3: Root package.json

```json
{
  "name": "my-fullstack",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "latest"
  }
}
```

### Step 4: turbo.json

```json
{
  "$schema": "https://turborepo.org/schema.json",
  "globalDependencies": ["package.json"],
  "pipeline": {
    "build": {
      "outputs": ["dist/**"],
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false
    },
    "lint": {}
  }
}
```

### Step 5: Root tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  },
  "extends": "typescript/lib/typescript.json"
}
```

### Step 6: Install & Verify

```bash
pnpm install
pnpm turbo build  # Should run all apps
```

---

## Create a Package Template

Use this as a template for new shared packages:

```
packages/my-package/
├─ src/
│  ├─ index.ts           # Public API
│  ├─ core.ts
│  └─ utils.ts
├─ tests/
│  └─ core.test.ts
├─ package.json
├─ tsconfig.json
└─ README.md
```

### package.json Template

```json
{
  "name": "@repo/my-package",
  "version": "0.0.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint src"
  },
  "dependencies": {},
  "devDependencies": {
    "@repo/config-typescript": "*",
    "@repo/config-eslint": "*",
    "typescript": "latest"
  }
}
```

### tsconfig.json Template

```json
{
  "extends": "@repo/config-typescript/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Prisma Setup Template

### apps/api/src/db/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  teams Team[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Team {
  id    Int     @id @default(autoincrement())
  name  String  @unique
  users User[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### apps/api/src/db/client.ts

```typescript
import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

export const db =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = db;
}
```

### apps/api/src/db/seed.ts

```typescript
import { db } from './client';

async function main() {
  // Seed data
  const user = await db.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      teams: {
        create: {
          name: 'Test Team',
        },
      },
    },
  });
  console.log('Seeded:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
```

### packages/api-contract/src/entities.ts

```typescript
export type { User, Team, Prisma } from '@prisma/client';

export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
```

---

## Pre-Commit Hooks for Monorepo

Add to `.git/hooks/pre-commit` (or use Husky):

```bash
#!/bin/bash
set -e

echo "🔍 Running lints..."
pnpm turbo run lint --filter='[HEAD]'

echo "✅ Checks passed!"
```

Install Husky:

```bash
pnpm add -D husky
pnpm exec husky install
pnpm exec husky add .husky/pre-commit 'pnpm turbo run lint'
```

---

## GitHub Actions CI Template

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - name: Setup database
        run: |
          cd apps/api
          DATABASE_URL="postgresql://postgres:password@localhost:5432/test_db" pnpm prisma migrate deploy

      - run: pnpm turbo run lint

      - run: pnpm turbo run build

      - run: pnpm turbo run test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()
```

---

## Migration Path: Separate Repos → Monorepo

If you have existing separate repos:

### 1. Create New Monorepo Root

```bash
mkdir my-fullstack
cd my-fullstack
pnpm init
# ... setup pnpm-workspace.yaml, turbo.json, tsconfig.json
```

### 2. Merge Repositories

```bash
# Clone existing repos as subdirectories
git clone <frontend-repo> apps/web
git clone <backend-repo> apps/api

# Remove their git history to merge
rm -rf apps/web/.git apps/api/.git

# Add to monorepo git
git add . && git commit -m "merge: add frontend and backend apps"
```

### 3. Deduplicate Dependencies

```bash
# Old structure: each app had own node_modules
# New: pnpm links all apps to single node_modules at root

# Remove apps/web/node_modules apps/api/node_modules
rm -rf apps/web/node_modules apps/api/node_modules

# Install once at root
pnpm install
```

### 4. Update Import Paths

```typescript
// Before (separate repos):
import { Button } from '../../../shared-ui/src/Button';

// After (monorepo):
import { Button } from '@repo/ui';
```

### 5. Test Build & Deploy

```bash
pnpm turbo build
pnpm dev  # Should start all apps
```

---

## Verification Checklist (Before Shipping)

- [ ] All packages export via `index.ts`
- [ ] No circular dependencies detected: `pnpm check-circular`
- [ ] All apps build: `pnpm turbo build`
- [ ] All tests pass: `pnpm turbo test`
- [ ] Lint passes: `pnpm turbo lint`
- [ ] Root `package.json` has all necessary root scripts
- [ ] `CONTRIBUTING.md` documents dependency rules
- [ ] `.github/workflows/ci.yml` runs on every push
- [ ] Remote Turbo cache configured (if using)
- [ ] Database setup documented (if using Prisma)
