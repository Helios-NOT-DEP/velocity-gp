# Repository Guidelines & Architecture

## Project Structure & Module Organization

This repository is a Vite-based React + TypeScript single-page application for Velocity GP. The app entry point is `src/main.tsx`, root composition is in `src/app/App.tsx`, and routing is defined in `src/app/routes.ts`.

**See [RepoStructure.md](./RepoStructure.md) for the complete directory layout with recent reorganization.**

Application code lives under `src/`:

- `src/app/pages`: route-level screens such as `Login`, `Garage`, `RaceHub`, `PitStop`, `HeliosProfile`, `Leaderboard`, and `VictoryLane`
- `src/app/components/ui`: reusable UI primitives
- `src/app/components/figma`: generated or design-oriented components that should be normalized before broad reuse
- `src/app/context`: shared application state, including `GameContext`
- `src/services`: business logic organized by domain (auth, api, game)
- `src/models`: centralized domain types
- `src/styles`: global theme, font, and Tailwind entry styles

Product, design, and implementation direction lives in `docs/`. Treat `docs/product/Velocity GP BDD Specifications.md` as the product behavior source of truth and `Tech Stack Needed.md` as the planned architecture direction. Use the `@` alias for imports from `src` where it improves readability.

## Build, Test, and Development Commands

Install dependencies with your preferred package manager, then run:

- `npm run dev`: starts the Vite development server.
- `npm run build`: creates a production bundle in `dist/`.
- `npm run lint`: run ESLint to check code style.
- `npm run format`: format code with Prettier.
- `npm test`: run automated tests with Vitest.

For detailed setup instructions, see [DEVELOPMENT.md](../../DEVELOPMENT.md).

## Coding Style & Naming Conventions

Follow the existing TypeScript/React style in `src/app`: functional components, semicolon-terminated statements, and single quotes in `.ts`/`.tsx` files. Use `PascalCase` for page and component filenames (`RaceHub.tsx`), `camelCase` for variables and helpers, and descriptive route paths in `src/app/routes.ts`. Keep shared UI additions in `src/app/components/ui` and page-specific composition inside the relevant file under `src/app/pages`.

Prefer established project patterns over introducing parallel abstractions. In particular:

- keep state updates immutable in context and page logic
- reuse existing UI primitives before adding new component systems
- keep product terminology aligned with the BDD specification
- avoid hardcoding backend assumptions in the frontend when the work depends on planned infrastructure in `Tech Stack Needed.md`

## Testing Guidelines

Tests are organized in `tests/` with unit, integration, and fixture directories. For any non-trivial feature, add tests alongside the code and prefer colocated names such as `ComponentName.test.tsx` or `route-name.test.ts`.

Before opening a PR:
- Run `npm run build` to verify production build succeeds
- Run `npm test` to verify tests pass
- Manually smoke-test affected routes with `npm run dev`

When introducing backend or integration work, favor testable seams and clean boundaries so the planned stack can be added without forcing a rewrite later. See [tests/README.md](../../tests/README.md) for full testing guidelines.

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

The current app is frontend-only, but implementation decisions should align with the planned stack documented in `Tech Stack Needed.md`:

- Frontend: React with TypeScript
- Database: PostgreSQL
- ORM: Prisma (schema in `src/db/`)
- Infrastructure: DigitalOcean App Platform, DigitalOcean Postgres, and a Droplet for `n8n`
- AI and service integrations: OpenAI, ElevenLabs, and SendGrid
- Authentication: Auth.js with email authentication
- Observability: PostHog with OpenTelemetry

Design new code so these systems can be introduced incrementally. Prefer clear boundaries for auth, data access, service integrations, observability, and background workflows instead of coupling UI components directly to future provider-specific logic.

## Best Practices

Implement changes with production-ready habits even when the repository is still early-stage:

- preserve the current React + Vite + Tailwind foundation and do not remove the React or Tailwind plugins from `vite.config.ts`
- keep route-level concerns in pages and move reusable logic into shared components, helpers, or context only when reuse is real
- prefer typed interfaces and explicit data shapes over ad hoc objects
- isolate external service calls behind thin client or service modules (use `src/services/` pattern)
- keep authentication, database access, and secret handling out of UI components
- add observability hooks in a way that can map cleanly to PostHog and OpenTelemetry later
- optimize for maintainability, accessibility, and responsive behavior instead of one-off implementations
- document any new tooling, architectural decisions, or workflow changes in `docs/` when they affect contributors

## Service Layer Organization

Business logic is organized by domain in `src/services/`:

- **`auth/`** — User authentication, session management, email verification
- **`api/`** — HTTP client (`apiClient.ts`), backend endpoint definitions (`endpoints.ts`)
- **`game/`** — Game mechanics (`gameService.ts`), race logic (`raceLogic.ts`)

Each service module should:
- Export a clean public API from `index.ts`
- Be testable in isolation (mock dependencies as needed)
- Avoid direct UI component coupling
- Use types from `src/models/`

## Configuration Notes

Do not remove the React or Tailwind plugins from `vite.config.ts`; the repo depends on both. Keep raw asset imports limited to supported file types already declared there, and avoid committing editor-specific artifacts such as `.DS_Store`.

Local workspace configs (`.agent/`, `.claude/`, `skills-lock.json`) are git-ignored and should not be committed to the shared repository.

---

**Quick Links**
- [DEVELOPMENT.md](../../DEVELOPMENT.md) — Setup & workflow
- [Tech Stack Needed.md](./Tech%20Stack%20Needed.md) — Architecture & planned features
- [Velocity GP BDD Specifications](../product/Velocity%20GP%20BDD%20Specifications.md) — Product requirements
