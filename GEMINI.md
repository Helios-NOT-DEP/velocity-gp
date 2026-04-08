# GEMINI.md - Velocity GP

This file provides context and instructions for AI agents working on the Velocity GP project.

## Project Overview
Velocity GP is a TypeScript monorepo for a multi-day endurance game experience. It features a React-based web application for players and administrators, and an Express-based Backend-for-Frontend (BFF) API that manages game state, scoring, and real-time events.

### Core Domain
- **Events**: Multi-day game instances with specific configurations (hazard ratios, pit durations).
- **Players & Teams**: Users participate as Players, usually organized into Teams.
- **Scanning**: The primary mechanic is scanning QRCodes to earn points.
- **Hazards & Pits**: Scans can trigger "hazards," placing a team in a timed "Pit Stop" state.
- **Rescue**: A cooperative mechanic where players can "rescue" others from hazards.
- **Roles**: `ADMIN`, `HELIOS` (event staff), and `PLAYER`.

## Technology Stack
- **Monorepo Manager**: npm Workspaces
- **Frontend**: React 18, Vite 6, Tailwind CSS 4, React Router 7
- **Backend**: Express 5, Prisma 7 (PostgreSQL), Zod 4
- **Shared Packages**: 
    - `@velocity-gp/api-contract`: Zod schemas and API definitions (Source of Truth).
    - `@velocity-gp/api-client`: Typed HTTP client for the frontend.
    - `@velocity-gp/ui`: Shared React components.
- **Observability**: OpenTelemetry, PostHog, Pino (logging).
- **Testing**: Vitest, React Testing Library, Supertest.

## Directory Structure
- `apps/web`: React frontend.
- `apps/api`: Express BFF and Prisma database layer.
- `packages/api-contract`: Shared schemas, domain types, and endpoint definitions.
- `packages/api-client`: Reusable API client utilizing `api-contract`.
- `packages/ui`: Shared UI primitives.
- `packages/config-typescript`: Shared TypeScript configurations.
- `docs/`: Extensive documentation on architecture, product specs (BDD), and design.
- `docs/adr`: Architecture Decision Records (ADR). All architecture decisions must be documented here as Markdown files.

## Building and Running

### Prerequisites
- Node.js 18+
- Docker (for local PostgreSQL)

### Setup
1. `npm install`
2. `cp .env.example .env.local`
3. `cp apps/api/.env.example apps/api/.env`
4. `docker compose up -d` (Starts PostgreSQL on port 16432)
5. `npm run db:deploy`
6. `npm run db:seed`

### Key Commands
- `npm run dev`: Starts all workspaces (Web, API, and shared packages).
- `npm run dev:web`: Starts only web-related workspaces.
- `npm run dev:api`: Starts only api-related workspaces.
- `npm run build`: Builds all workspaces.
- `npm test`: Runs Vitest suites across the monorepo.
- `npm run db:migrate`: Create and apply database migrations.
- `npm run db:studio`: Open Prisma Studio.

## Development Conventions

### General
- **Functional First**: Use functional components and hooks for React; avoid classes.
- **Type Safety**: Use explicit types; strictly avoid `any`. Use Zod schemas from `api-contract` for validation.
- **Surgical Updates**: When modifying code, stick to the established style and minimize unrelated changes.
- **Architecture Decisions**: Document every architecture decision in `docs/adr` as a Markdown ADR.
- **Design Source of Truth**: Treat the Velocity GP Figma Make file as the primary design source: `https://www.figma.com/make/PobyEVqOy3IKJ8EUPUr6Vh/Velocity-GP-v1?t=UvkDEfpEreGXp1p3-1`.

### Frontend (`apps/web`)
- **Styling**: Use Tailwind CSS exclusively. Follow the theme in `src/styles/theme.css`.
- **Imports**: Use `@/` for local app imports and `@velocity-gp/*` for shared packages.
- **State Management**: Use `GameContext` for global game state; keep page-specific logic in hooks or services.

### Backend (`apps/api`)
- **Architecture**: Route handlers in `src/routes/`, business logic in `src/services/`.
- **Validation**: All request/response bodies must be validated against `api-contract` schemas.
- **Database**: Use Prisma Client (generated in `src/db/generated`).

### Shared Contracts
- **Schema First**: Changes to API inputs/outputs must start in `packages/api-contract`.
- **Versioning**: Maintain version consistency across internal packages.

## Verification Workflow
1. **Reproduce**: Before fixing a bug, create a failing test case in the relevant `tests/` directory.
2. **Implement**: Apply the fix or feature.
3. **Validate**:
    - Run `npm run lint`.
    - Run workspace-specific tests (e.g., `npm run test --workspace=@velocity-gp/api`).
    - Run `npm run build` to ensure no breaking changes in shared contracts.
