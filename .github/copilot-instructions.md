# Project Guidelines

## Architecture

- This is a React + TypeScript + Vite single-page app.
- App entry is `src/main.tsx` and root composition is in `src/app/App.tsx`.
- Route definitions live in `src/app/routes.ts`; add new screens as route-level pages in `src/app/pages/`.
- Shared game state is centralized in `src/app/context/GameContext.tsx` via `GameProvider` and `useGame()`.
- Keep state updates immutable in context and page logic.

## Code Style

- Use functional React components and hooks (no class components).
- Prefer existing UI primitives from `src/app/components/ui/` before introducing new component patterns.
- Use the `@/` alias (mapped to `src/`) for imports when it improves readability.
- Keep styling consistent with existing Tailwind + theme patterns in `src/styles/index.css` and `src/styles/theme.css`.

## Build and Test

- Install dependencies: `npm install`
- Start development server: `npm run dev`
- Create production build: `npm run build`
- There is currently no test runner configured; if adding tests, scaffold Vitest + React Testing Library first and keep tests close to feature files.

## Conventions

- Treat `docs/Velocity GP BDD Specifications.md` as the product behavior source of truth (game rules, personas, scenarios).
- Use terms from the BDD spec consistently (e.g., `IN_PIT`, hazard ratio, Helios rescue).
- For planned backend/integration direction, reference `docs/Tech Stack Needed.md` instead of hardcoding assumptions in frontend code.
- Prefer linking to existing docs instead of duplicating long requirements in code comments.

## Reference Docs

- Product behavior: `docs/Velocity GP BDD Specifications.md`
- Technology direction: `docs/Tech Stack Needed.md`
- Design prompt/context: `docs/Figma Design Prompt.md`
