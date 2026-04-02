# Repo structure (team guide)

- `src/` - application source
  - `src/app` - route-level pages and app composition
  - `src/app/components` - UI primitives and figma-derived components
  - `src/app/context` - React context providers
  - `src/hooks` - reusable hooks
  - `src/services` - thin API/service clients
  - `src/utils` - pure helpers and formatters
  - `src/types` - shared TS types

Conventions:
- Keep presentational primitives in `components/ui` and prefer re-using them.
- Use `@/` alias for imports where configured.
- Keep side effects inside hooks/services, not in render.
