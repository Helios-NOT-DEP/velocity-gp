# Repository Guidelines & Architecture

## Project Structure & Module Organization

This repository is an npm-workspaces fullstack monorepo for Velocity GP. The web app entry point is `apps/web/src/main.tsx`, root composition is in `apps/web/src/app/App.tsx`, routing is defined in `apps/web/src/app/routes.ts`, and the API app lives in `apps/api`.

**See [RepoStructure.md](./RepoStructure.md) for the complete directory layout with recent reorganization.**

Application code and shared modules are split across `apps/*` and `packages/*`:

- `apps/web/src/app/pages`: route-level screens such as `Login`, `Garage`, `RaceHub`, `PitStop`, `HeliosProfile`, `Leaderboard`, and `VictoryLane`
- `packages/ui/src/components`: reusable UI primitives
- `apps/web/src/app/components/figma`: generated or design-oriented components that should be normalized before broad reuse
- `apps/web/src/app/context`: shared application state, including `GameContext`
- `apps/web/src/services`: web auth, game, API, and observability logic
- `apps/web/src/styles`: global theme, font, and Tailwind entry styles
- `apps/api/src`: Express routes, middleware, services, and Prisma DB code
- `packages/api-contract`: shared DTOs, endpoint builders, and Zod schemas
- `packages/api-client`: reusable HTTP client

Product, design, and implementation direction lives in `docs/`. Treat `docs/product/Velocity GP BDD Specifications.md` as the product behavior source of truth and `Tech Stack Needed.md` as the planned architecture direction. Use `@` for `apps/web/src` imports and `@velocity-gp/*` for shared packages.

## Build, Test, and Development Commands

Install dependencies with npm at the repository root, then run:

- `npm run dev`: starts both the web and API dev servers.
- `npm run dev:web`: starts only the web dev server.
- `npm run dev:api`: starts only the API dev server.
- `npm run build`: builds shared packages and both app workspaces.
- `npm run lint`: runs ESLint across workspaces.
- `npm run format`: format code with Prettier.
- `npm test`: run workspace test suites with Vitest.

For detailed setup instructions, see [DEVELOPMENT.md](../../DEVELOPMENT.md).

## Coding Style & Naming Conventions

Follow the existing TypeScript/React style in `apps/web/src/app`: functional components, semicolon-terminated statements, and single quotes in `.ts`/`.tsx` files. Use `PascalCase` for page and component filenames (`RaceHub.tsx`), `camelCase` for variables and helpers, and descriptive route paths in `apps/web/src/app/routes.ts`. Keep shared UI additions in `packages/ui/src/components` and page-specific composition inside the relevant file under `apps/web/src/app/pages`.

Prefer established project patterns over introducing parallel abstractions. In particular:

- keep state updates immutable in context and page logic
- reuse existing UI primitives before adding new component systems
- keep product terminology aligned with the BDD specification
- avoid hardcoding backend assumptions in the frontend when the work depends on planned infrastructure in `Tech Stack Needed.md`

## Testing Guidelines

Tests are organized in each workspace (`apps/web/tests`, `apps/api/tests`, package-local `tests/`).

Current test taxonomy:
- API: `apps/api/tests/unit`, `apps/api/tests/integration`
- Web: `apps/web/tests/unit`, `apps/web/tests/component`, `apps/web/tests/e2e`

For any non-trivial feature, add tests in the correct tier and prefer names such as `ComponentName.test.tsx` or `route-name.test.ts`.

Before opening a PR:
- Run `npm run build` to verify production build succeeds
- Run `npm test` to verify tests pass
- Manually smoke-test affected routes with `npm run dev`

When introducing backend or integration work, favor testable seams and clean boundaries so the planned stack can be added without forcing a rewrite later. See [apps/web/tests/README.md](../../apps/web/tests/README.md) for full testing guidelines.

## Commit & Pull Request Guidelines

Recent history favors short conventional commits such as `feat: ...`, `fix: ...`, and `docs: ...`; use that format consistently and avoid vague messages like `update`. Keep commits scoped to a single concern. PRs should include:

- Clear description of changes
- Link to relevant GitHub Issue if applicable
- List of impacted routes/components
- Screenshots for UI changes
- Verification that `npm run build` passes

GitHub Issues is the backlog of record for this repository. Track feature work, bugs, and follow-up tasks in the Helios project board:

- Backlog: `https://github.com/orgs/Helios-NOT-DEP/projects/4`

When making changes tied to planned work, reference the relevant GitHub Issue in commits, PRs, or implementation notes where appropriate.

## Planned Tech Stack

Implementation decisions should align with the planned stack documented in `Tech Stack Needed.md`:

- Frontend: React with TypeScript
- Database: PostgreSQL
- ORM: Prisma (schema in `apps/api/src/db/`)
- Infrastructure: DigitalOcean App Platform, DigitalOcean Postgres, and a Droplet for `n8n`
- AI and service integrations: OpenAI, ElevenLabs, and SendGrid
- Authentication: Auth.js with email authentication
- Observability: PostHog with OpenTelemetry

Design new code so these systems can be introduced incrementally. Prefer clear boundaries for auth, data access, service integrations, observability, and background workflows instead of coupling UI components directly to future provider-specific logic.

## Best Practices

Implement changes with production-ready habits even when the repository is still early-stage:

- preserve the current React + Vite + Tailwind foundation and do not remove the React or Tailwind plugins from `apps/web/vite.config.ts`
- keep route-level concerns in pages and move reusable logic into shared components, helpers, or context only when reuse is real
- prefer typed interfaces and explicit data shapes over ad hoc objects
- isolate external service calls behind thin client or service modules and package boundaries (`apps/web/src/services`, `apps/api/src/services`, `packages/*`)
- keep authentication, database access, and secret handling out of UI components
- add observability hooks in a way that can map cleanly to PostHog and OpenTelemetry later
- optimize for maintainability, accessibility, and responsive behavior instead of one-off implementations
- document any new tooling, architectural decisions, or workflow changes in `docs/` when they affect contributors

## Service Layer Organization

Web app business logic is organized by domain in `apps/web/src/services/`:

- **`auth/`** — User authentication, session management, email verification
- **`api/`** — app-local API client instance backed by `packages/api-client` and `packages/api-contract`
- **`game/`** — Game mechanics (`gameService.ts`), race logic (`raceLogic.ts`)

Each service module should:
- Export a clean public API from `index.ts`
- Be testable in isolation (mock dependencies as needed)
- Avoid direct UI component coupling
- Use shared API/DTO types from `@velocity-gp/api-contract`

## Configuration Notes

Do not remove the React or Tailwind plugins from `apps/web/vite.config.ts`; the repo depends on both. Keep raw asset imports limited to supported file types already declared there, and avoid committing editor-specific artifacts such as `.DS_Store`.

Local workspace configs (`.agent/`, `.claude/`, `skills-lock.json`) are git-ignored and should not be committed to the shared repository.

---

**Quick Links**
- [DEVELOPMENT.md](../../DEVELOPMENT.md) — Setup & workflow
- [Tech Stack Needed.md](./Tech%20Stack%20Needed.md) — Architecture & planned features
- [Velocity GP BDD Specifications](../product/Velocity%20GP%20BDD%20Specifications.md) — Product requirements
