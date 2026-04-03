# Repo structure (team guide)

- `apps/web/` - React + Vite frontend
  - `apps/web/src/app` - route-level pages and app composition
  - `apps/web/src/app/components` - app-local components and figma-derived components
  - `apps/web/src/app/context` - React context providers
  - `apps/web/src/hooks` - reusable hooks
  - `apps/web/src/services` - web-specific auth, game, API, and observability modules
  - `apps/web/src/utils` - pure helpers and formatters
- `apps/api/` - Express BFF and Prisma backend
  - `apps/api/src/app` - app setup and middleware wiring
  - `apps/api/src/routes` - route handlers
  - `apps/api/src/services` - backend business logic
  - `apps/api/src/db` - Prisma schema, migrations, and client
- `packages/api-contract/` - shared DTOs, route builders, and Zod schemas
- `packages/api-client/` - reusable HTTP client
- `packages/ui/` - shared UI primitives
- `packages/config-typescript/` - shared TS presets

Conventions:
- Keep presentational primitives in `packages/ui/src/components` and prefer re-using them.
- Use `@/` for `apps/web/src` imports and `@velocity-gp/*` for shared packages.
- Keep side effects inside hooks/services, not in render.
