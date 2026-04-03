# Prisma ORM in Monorepos

## Architecture Pattern

In a fullstack monorepo, Prisma is centralized in the backend but exports types across the stack:

### Where Things Live

| Component      | Location                                | Purpose                                   |
| -------------- | --------------------------------------- | ----------------------------------------- |
| **Schema**     | `apps/api/src/db/schema.prisma`         | Single source of truth for data model     |
| **Migrations** | `apps/api/src/db/migrations/`           | Version-controlled schema changes         |
| **Client**     | `apps/api/src/db/client.ts`             | PrismaClient singleton (server-side only) |
| **Types**      | `packages/api-contract/src/entities.ts` | Re-exported Prisma types for frontend     |
| **.env**       | `apps/api/.env.local`                   | DATABASE_URL (not in frontend)            |

## Setup Checklist

### 1. Initialize Prisma in Backend

```bash
cd apps/api
pnpm add -D prisma
pnpm prisma init
```

This creates:

- `.env.local` with `DATABASE_URL` placeholder
- `src/db/schema.prisma`

### 2. Configure Schema

```prisma
// apps/api/src/db/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../node_modules/@prisma/client"
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
}

model Team {
  id      Int     @id @default(autoincrement())
  name    String
  users   User[]
}
```

### 3. Create Client Wrapper

```typescript
// apps/api/src/db/client.ts
import { PrismaClient } from '@prisma/client';

// Singleton pattern to avoid exhausting connection pool
let db: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  db = new PrismaClient();
} else {
  let globalWithPrisma = global as typeof globalThis & {
    prisma: PrismaClient;
  };
  if (!globalWithPrisma.prisma) {
    globalWithPrisma.prisma = new PrismaClient({
      log: ['warn', 'error'],
    });
  }
  db = globalWithPrisma.prisma;
}

export { db };
```

### 4. Export Types for Frontend

```typescript
// packages/api-contract/src/entities.ts
// Re-export Prisma types so frontend never imports directly from @prisma/client

export type { User, Team, Game } from '@prisma/client';
export * as PrismaTypes from '@prisma/client';

// Export runtime Prisma enums if you use them
export { Prisma } from '@prisma/client';
```

### 5. Update Frontend package.json

Add `api-contract` as a dependency:

```json
// apps/web/package.json
{
  "dependencies": {
    "@repo/api-contract": "*"
  }
}
```

### 6. Consume in Frontend

```typescript
// apps/web/src/components/UserProfile.tsx
import type { User } from '@repo/api-contract';

interface Props {
  user: User;
}

export function UserProfile({ user }: Props) {
  return <div>{user.name}</div>;
}
```

## Key Patterns

### ✓ Repository Pattern (Recommended)

Keep data access logic in dedicated repository files:

```typescript
// apps/api/src/repositories/userRepository.ts
import { db } from '@/db/client';
import type { User } from '@prisma/client';

export const userRepository = {
  async findById(id: number): Promise<User | null> {
    return db.user.findUnique({ where: { id } });
  },

  async create(data: { email: string; name?: string }): Promise<User> {
    return db.user.create({ data });
  },

  async update(id: number, data: Partial<User>): Promise<User> {
    return db.user.update({ where: { id }, data });
  },

  async delete(id: number): Promise<User> {
    return db.user.delete({ where: { id } });
  },
};
```

Then call from services:

```typescript
// apps/api/src/services/userService.ts
import { userRepository } from '@/repositories/userRepository';

export const userService = {
  async getUser(id: number) {
    return userRepository.findById(id);
  },
};
```

### ✓ DTOs (Data Transfer Objects)

Define request/response shapes separately from Prisma models:

```typescript
// packages/api-contract/src/users.ts
import { z } from 'zod';
import type { User } from '@prisma/client';

// Request schema
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export type CreateUserRequest = z.infer<typeof createUserSchema>;

// Response schema (exclude sensitive fields)
export const userResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullable(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;

// Conversion function
export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
```

### ❌ Anti-Patterns

**1. Direct ORM entity exposure**

```typescript
// ❌ BAD: Frontend sees internal database structure
export async function getUser(id: number): Promise<User> {
  return db.user.findUnique({ where: { id } });
}
```

**2. Importing @prisma/client in frontend**

```typescript
// ❌ BAD: Frontend should not import Prisma directly
import { PrismaClient } from '@prisma/client';
```

**3. Running migrations from app code**

```typescript
// ❌ BAD: Don't call prisma migrate in application code
db.$executeRaw`ALTER TABLE users ADD COLUMN phone VARCHAR(20);`;
```

## Migrations

### Running Migrations

```bash
# In apps/api directory
pnpm prisma migrate dev --name add_user_phone
pnpm prisma migrate deploy  # production
```

### Committing Schema Changes

1. **Update schema**: Edit `apps/api/src/db/schema.prisma`
2. **Create migration**: `pnpm prisma migrate dev --name <name>`
3. **Commit**: Both schema and migration file should be committed
4. **Pull Request**: Teammates `pnpm prisma migrate dev` to sync

## Serverless & Connection Pooling

### Serverless Functions with Prisma

Use Prisma Data Proxy (or PgBouncer) to manage connection pools:

```typescript
// apps/api/src/db/client.ts (serverless variant)
import { PrismaClient } from '@prisma/client';

const globalWithPrisma = global as typeof globalThis & {
  prisma: PrismaClient;
};

if (!globalWithPrisma.prisma) {
  globalWithPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : [],
  });
}

const db = globalWithPrisma.prisma;

// For edge functions, disconnect after each request
export async function withPrisma<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } finally {
    await db.$disconnect();
  }
}
```

### Enable Prisma Data Proxy

1. [Get a Prisma Data Proxy key](https://www.prisma.io/docs/orm/reference/preview-features/client-extensions)
2. Update `.env.local`:
   ```
   DATABASE_URL="prisma://..."
   ```

## Testing with Prisma

### Mock PrismaClient in Tests

```typescript
// apps/api/src/__mocks__/db.ts
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

jest.mock('@/db/client', () => ({
  __esModule: true,
  db: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(db);
});
```

### Use Test Database

```bash
# Run tests against separate test database
DATABASE_URL="postgresql://user:password@localhost:5432/myapp_test" pnpm vitest
```

## Performance Tips

1. **Use `.select()` to limit fields**: Reduce payload size

   ```typescript
   db.user.findMany({ select: { id: true, email: true } });
   ```

2. **Batch queries with `.groupBy()` or raw SQL**: Avoid N+1s

   ```typescript
   db.user.groupBy({ by: ['teamId'], _count: true });
   ```

3. **Index frequently-queried fields**: Define in schema

   ```prisma
   model User {
     id    Int  @id
     email String @unique
     @@index([email])
   }
   ```

4. **Use Data Loader pattern for nested queries**: When exposing GraphQL

5. **Connection pooling**: Critical for serverless and high concurrency
