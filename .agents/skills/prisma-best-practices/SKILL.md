---
name: prisma-best-practices
description: 'Apply Prisma ORM best practices for schema design, query optimization, type safety, security, testing, and production rollout. Use when reviewing Prisma code, adding models/queries, fixing slow database paths, preparing migrations, or hardening Prisma usage in server/serverless apps. Triggers: "Prisma best practices", "optimize Prisma", "N+1", "migrate deploy", "raw SQL safety", "connection pooling".'
license: MIT
metadata:
  author: Neer Patel
  version: '1.0.0'
---

# Prisma ORM Best Practices Workflow

Use this skill as a repeatable workflow to design, review, or refactor Prisma usage with production-safe defaults.

## When to Apply

Apply this skill when you are:

- Adding or modifying Prisma models and relations
- Investigating slow queries or high DB load
- Choosing between `migrate dev`, `db push`, and `migrate deploy`
- Using raw SQL (`$queryRaw`, `$executeRaw`) and need injection-safe patterns
- Hardening Prisma usage for serverless/high-concurrency environments
- Preparing test strategy for Prisma-backed features

## What This Skill Produces

- A Prisma implementation plan with explicit decisions
- A checked best-practices review across schema, query patterns, security, and deployment
- A final readiness checklist for development and production

## Step-by-Step Procedure

### 1) Baseline context and runtime

Collect:

- Database provider (Postgres/MySQL/SQLite/MongoDB)
- Runtime shape (long-running server vs serverless)
- Environment target (development, test, production)
- Query pain points (latency, high reads, N+1, connection limits)

### 2) Validate schema design

Check:

- Naming: `PascalCase` model names, `camelCase` fields
- Legacy compatibility via `@map` and `@@map`
- Relations explicitly modeled on both sides
- Indexes on `where`, `orderBy`, and relation scalar fields
- `enum` for stable finite sets; `String` for frequently changing/user-defined values
- Multi-file schema organization for larger domains

### 3) Validate query patterns and performance

Check:

- Reuse a single `PrismaClient` instance (avoid per-request instantiation)
- Prevent N+1:
  - Prefer nested reads (`include`) or batched `in` filters
  - In GraphQL-style resolvers, use fluent API batching with `findUnique(...).relation()` when relevant
  - Consider `relationLoadStrategy: "join"` where appropriate
- Fetch only needed fields (`select`) and exclude sensitive fields (`omit`)
- Pagination strategy:
  - Offset pagination for small datasets and random page jumps
  - Cursor pagination for large datasets/infinite scroll
- Use bulk operations (`createMany`, `updateMany`, `deleteMany`) for high-volume writes
- Use Query Insights to identify expensive query shapes before changing code

### 4) Enforce type-safety and input validation

Check:

- Prefer generated Prisma types over duplicate interfaces
- Validate all external input (e.g., Zod) before Prisma calls
- Keep query results typed, especially for raw queries

### 5) Apply security guardrails

Check:

- Prefer Prisma ORM query API over raw SQL whenever possible
- For raw SQL, prefer tagged-template `$queryRaw` / `$executeRaw`
- Never concatenate untrusted input into SQL strings
- Use `$queryRawUnsafe`/`$executeRawUnsafe` only when unavoidable, with strict parameterization
- Ensure sensitive fields are excluded globally or per-query via `omit`

### 6) Choose migration strategy by environment

- Development:
  - Use `prisma migrate dev`
  - Use `--create-only` when a migration needs manual edits
  - Use `prisma migrate reset` only for development reset workflows
- Production/Test:
  - Use `prisma migrate deploy` in CI/CD
  - Do **not** use `migrate dev` or `db push` in production

### 7) Connection strategy (Prisma Postgres specific)

- Application traffic: pooled connection hostname
- Migrations/admin/introspection/studio/long-running session-dependent tasks: direct connection hostname
- If seeing connection exhaustion:
  - Verify single client reuse
  - Cap serverless concurrency or increase plan capacity
  - Ensure app traffic is not using direct connection host

## Decision Points

| Decision                | Choose A                                         | Choose B                                                   |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Pagination              | Offset for small datasets + arbitrary page jumps | Cursor for large datasets + infinite scroll                |
| Related data loading    | `include` / batched `in` for common cases        | `relationLoadStrategy: "join"` for one-query join strategy |
| SQL access              | Prisma query API first                           | Raw SQL only for unsupported/heavily optimized cases       |
| Raw SQL method          | `$queryRaw` / `$executeRaw` tagged templates     | Unsafe variants only if unavoidable + parameterized        |
| Migration command       | `migrate dev` in development                     | `migrate deploy` in production/test                        |
| Prisma client lifecycle | Shared singleton client                          | Never per-request instantiation                            |

## Completion Criteria

Mark work complete only if all are true:

- [ ] Schema and relation modeling follow naming + indexing conventions
- [ ] Query path reviewed for N+1, over-fetching, and pagination fit
- [ ] Prisma client reuse strategy is correct for runtime
- [ ] Input validation and generated-type usage are in place
- [ ] Raw SQL usage (if any) is parameterized and injection-safe
- [ ] Migration flow is environment-appropriate
- [ ] Sensitive fields are excluded from outputs
- [ ] Performance verification path exists (e.g., Query Insights or equivalent)

## References

- Best practices: https://www.prisma.io/docs/orm/more/best-practices
- Query optimization: https://www.prisma.io/docs/orm/prisma-client/queries/advanced/query-optimization-performance
- Raw queries and SQL injection prevention: https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries
- Prisma Migrate (dev vs prod): https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- Query Insights: https://www.prisma.io/docs/query-insights
- Prisma Postgres pooling: https://www.prisma.io/docs/postgres/database/connection-pooling
