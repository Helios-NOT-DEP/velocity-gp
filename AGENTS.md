# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vite-based React + TypeScript single-page application for Velocity GP. The app entry point is `src/main.tsx`, root composition is in `src/app/App.tsx`, and routing is defined in `src/app/routes.ts`.

Application code lives under `src/`:

- `src/app/pages`: route-level screens such as `Login`, `Garage`, `RaceHub`, `PitStop`, `HeliosProfile`, `Leaderboard`, and `VictoryLane`
- `src/app/components/ui`: reusable UI primitives
- `src/app/components/figma`: generated or design-oriented components that should be normalized before broad reuse
- `src/app/context`: shared application state, including `GameContext`
- `src/styles`: global theme, font, and Tailwind entry styles

Product, design, and implementation direction lives in `docs/` and `guidelines/`. Treat `docs/Velocity GP BDD Specifications.md` as the product behavior source of truth and `docs/Tech Stack Needed.md` as the planned architecture direction. Use the `@` alias for imports from `src` where it improves readability.

## Build, Test, and Development Commands
Install dependencies with your preferred package manager, then run:

- `npm run dev`: starts the Vite development server.
- `npm run build`: creates a production bundle in `dist/`.

There is currently no committed lockfile, lint script, or test script. If you add one, document it in `package.json` and update this guide in the same change. Prefer adding a lightweight quality baseline as the codebase grows:

- `vitest` + React Testing Library for unit and component tests
- linting and formatting scripts if new tooling is introduced
- verification steps that keep `npm run build` green before merge

## Coding Style & Naming Conventions
Follow the existing TypeScript/React style in `src/app`: functional components, semicolon-terminated statements, and single quotes in `.ts`/`.tsx` files. Use `PascalCase` for page and component filenames (`RaceHub.tsx`), `camelCase` for variables and helpers, and descriptive route paths in `src/app/routes.ts`. Keep shared UI additions in `src/app/components/ui` and page-specific composition inside the relevant file under `src/app/pages`.

Prefer established project patterns over introducing parallel abstractions. In particular:

- keep state updates immutable in context and page logic
- reuse existing UI primitives before adding new component systems
- keep product terminology aligned with the BDD specification
- avoid hardcoding backend assumptions in the frontend when the work depends on planned infrastructure in `docs/Tech Stack Needed.md`

## Testing Guidelines
Automated tests are not configured in the current repository. For any non-trivial feature, add tests alongside the tooling needed to run them, and prefer colocated names such as `ComponentName.test.tsx` or `route-name.test.ts`. Before opening a PR, at minimum verify `npm run build` succeeds and manually smoke-test the affected routes in `npm run dev`.

When introducing backend or integration work, favor testable seams and clean boundaries so the planned stack can be added without forcing a rewrite later.

## Commit & Pull Request Guidelines
Recent history favors short conventional commits such as `feat: ...`, `fix: ...`, and `docs: ...`; use that format consistently and avoid vague messages like `update`. Keep commits scoped to a single concern. PRs should include a concise description, linked issue or requirement when available, impacted routes/components, and screenshots or short recordings for UI changes.

GitHub Issues is the backlog of record for this repository. Track feature work, bugs, and follow-up tasks in the Helios project board:

- Backlog: `https://github.com/orgs/Helios-NOT-DEP/projects/4`

When making changes tied to planned work, reference the relevant GitHub Issue in commits, PRs, or implementation notes where appropriate.

## Planned Tech Stack
The current app is frontend-only, but implementation decisions should align with the planned stack documented in `docs/Tech Stack Needed.md`:

- Frontend: React with TypeScript
- Database: PostgreSQL
- ORM: Prisma
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
- isolate external service calls behind thin client or service modules when they are introduced
- keep authentication, database access, and secret handling out of UI components
- add observability hooks in a way that can map cleanly to PostHog and OpenTelemetry later
- optimize for maintainability, accessibility, and responsive behavior instead of one-off implementations
- document any new tooling, architectural decisions, or workflow changes in `docs/` and this file when they affect contributors

## Configuration Notes
Do not remove the React or Tailwind plugins from `vite.config.ts`; the repo depends on both. Keep raw asset imports limited to supported file types already declared there, and avoid committing editor-specific artifacts such as `.DS_Store`.
