# Project Guidelines

## Architecture

- This is a React + TypeScript + Vite single-page app.
- App entry is `src/main.tsx` and root composition is in `src/app/App.tsx`.
- Route definitions live in `src/app/routes.ts`; add new screens as route-level pages in `src/app/pages/`.
- Shared game state is centralized in `src/app/context/GameContext.tsx` via `GameProvider` and `useGame()`.
- Reusable primitives belong in `src/app/components/ui/`; `src/app/components/figma/` may contain design-derived components that should be rationalized before widespread reuse.
- Keep state updates immutable in context and page logic.

## Code Style

- Use functional React components and hooks (no class components).
- Prefer existing UI primitives from `src/app/components/ui/` before introducing new component patterns.
- Use the `@/` alias (mapped to `src/`) for imports when it improves readability.
- Keep styling consistent with existing Tailwind + theme patterns in `src/styles/index.css` and `src/styles/theme.css`.
- Use semicolon-terminated statements and single quotes in `.ts` and `.tsx` files.
- Use `PascalCase` for component and page filenames and `camelCase` for variables and helpers.

## Build and Test

- `npm run dev`: run full local stack (shared packages + web + api in watch mode).
- `npm run dev:web`: run frontend-focused stack only.
- `npm run dev:api`: run backend-focused stack only.
- `npm run build`: build all workspaces in dependency order.
- `npm run lint`: run ESLint in all workspaces.
- `npm test`: run tests across workspaces (after building shared packages).
- `npm run db:deploy` / `npm run db:seed`: apply Prisma migrations and seed local DB.

## Conventions

- Treat `docs/Velocity GP BDD Specifications.md` as the product behavior source of truth (game rules, personas, scenarios).
- Use terms from the BDD spec consistently (e.g., `IN_PIT`, hazard ratio, Helios rescue).
- GitHub Issues is the backlog of record for this repo. Planned work should align with the Helios project board: `https://github.com/orgs/Helios-NOT-DEP/projects/4`.
- For planned backend and integration direction, reference `docs/Tech Stack Needed.md` instead of hardcoding assumptions in frontend code.
- Prefer linking to existing docs instead of duplicating long requirements in code comments.
- All architecture decisions must be documented as Markdown ADRs in `docs/adr/`.
- The Velocity GP design source is the Figma Make file: `https://www.figma.com/make/PobyEVqOy3IKJ8EUPUr6Vh/Velocity-GP-v1?t=UvkDEfpEreGXp1p3-1`.

## Planned Stack

- Frontend: React with TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Infrastructure: DigitalOcean App Platform, DigitalOcean Postgres, and a Droplet for `n8n`
- AI and service integrations: OpenAI, ElevenLabs, and SendGrid
- Authentication: Auth.js email authentication
- Observability: PostHog with OpenTelemetry

## Best Practices

- Keep route composition in page components and extract shared logic only when it improves clarity or reuse.
- Prefer typed domain models and service boundaries that can support the planned Postgres + Prisma backend cleanly.
- Keep auth, persistence, and third-party service logic out of presentational components.
- Introduce external integrations through thin modules or service layers so providers can be swapped or tested.
- Preserve accessibility, responsive layout behavior, and maintainable state flows as first-class concerns.
- When adding tooling or architecture changes, update the relevant docs and contributor instructions in the same change.

## Reference Docs

- Product behavior: `docs/Velocity GP BDD Specifications.md`
- Technology direction: `docs/Tech Stack Needed.md`
- Design prompt/context: `docs/Figma Design Prompt.md`
- Figma Make source: `https://www.figma.com/make/PobyEVqOy3IKJ8EUPUr6Vh/Velocity-GP-v1?t=UvkDEfpEreGXp1p3-1`
