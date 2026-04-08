# Repository Guidelines

## Project Structure & Module Organization
Velocity GP is a TypeScript monorepo using npm workspaces.

- `apps/web/`: React + Vite frontend (`src/` for features and UI, `tests/` for web tests, `dist/` for build output).
- `apps/api/`: Express BFF + Prisma (`src/` for routes/services, `prisma/` for schema and seed logic, `tests/` for API tests).
- `packages/api-contract/`: shared endpoint contracts, schemas, and domain types.
- `packages/api-client/`: typed HTTP client used by apps.
- `packages/ui/`: shared UI primitives.
- `docs/`: architecture, product, and contributor documentation.
- `docs/adr/`: Architecture Decision Records (Markdown only).

Keep shared types/contracts in `packages/api-contract` instead of duplicating them in apps.
All architecture decisions must be documented as Markdown files in `docs/adr/`.

## Build, Test, and Development Commands
- `npm run dev`: run full local stack (shared packages + web + api in watch mode).
- `npm run dev:web`: run frontend-focused stack only.
- `npm run dev:api`: run backend-focused stack only.
- `npm run build`: build all workspaces in dependency order.
- `npm run lint`: run ESLint in all workspaces.
- `npm test`: run tests across workspaces (after building shared packages).
- `npm run db:deploy` / `npm run db:seed`: apply Prisma migrations and seed local DB.

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts`, `.tsx`), ESM modules.
- Indentation: follow existing file style (2 spaces in most TS/JS files).
- Strings/terminators: single quotes and semicolons.
- Naming: `PascalCase` for React component files (e.g., `RaceHubScanner.tsx`), `camelCase` for functions/variables/hooks (e.g., `useRaceState`).
- Imports: use `@/` aliases in `apps/web` and `@velocity-gp/*` for shared packages.
- Tooling: ESLint (`eslint.config.js`) and Prettier (`npm run format`, `npm run format:check`).

## Testing Guidelines
- Framework: Vitest with V8 coverage (`vitest.config.ts`).
- Test files: `*.test.ts` / `*.test.tsx` in workspace `tests/` directories.
- Run all tests with `npm test`; run focused tests with `npm test -- <file>.test.ts`.
- Prioritize tests for route behavior, service logic, hooks, and shared contracts.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `<type>(optional-scope): <subject>`.
  - Examples: `feat(api): add auth headers`, `fix(RaceHub): handle scanner permission denial`.
- Keep commits focused and logically grouped.
- PRs should include: clear summary, linked issue (if applicable), screenshots for UI changes, and confirmation that `npm run lint`, `npm test`, and `npm run build` pass.

## Security & Configuration Tips
- Never commit secrets or local env files.
- Initialize local config with:
  - `cp .env.example .env.local`
  - `cp apps/api/.env.example apps/api/.env`
- Use `docker compose up -d` to start local Postgres when working on DB-backed features.

## Design Source of Truth
- The Velocity GP site design is sourced from Figma Make: `https://www.figma.com/make/PobyEVqOy3IKJ8EUPUr6Vh/Velocity-GP-v1?t=UvkDEfpEreGXp1p3-1`.
