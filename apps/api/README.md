# Velocity GP Backend (BFF)

This folder contains the Express-based Backend for Frontend (BFF) for Velocity GP. It currently exposes placeholder endpoints that mirror the frontend API contract so the team can add real persistence, auth, and workflow integrations incrementally.

## Why this structure

The backend is organized by responsibility instead of piling everything into a single `server.ts` file:

- `src/app/` — Express app composition and middleware wiring
- `src/config/` — environment parsing and runtime configuration
- `../../packages/api-contract/` — shared API response, domain, endpoint, and Zod contracts
- `src/db/` — Prisma schema, migrations, and database client
- `src/lib/` — reusable infrastructure helpers such as logging and async wrappers
- `src/middleware/` — request context, validation, error handling, and not-found behavior
- `src/routes/` — transport layer, one file per domain
- `../../packages/api-contract/src/schemas/` — shared Zod validators at the HTTP boundary
- `src/services/` — placeholder business logic, isolated from Express
- `src/utils/` — shared utilities and error types
- `tests/unit/` — backend unit tests
- `tests/integration/` — backend integration tests

## Local development

1. Run `npm install` at the repository root.
2. Copy `.env.example` to `.env` inside this folder.
3. Start the backend server.

Optional commands:

- `npm run dev` — starts the backend on `http://localhost:4000`
- `npm run build` — compiles the backend into `dist/`
- `npm run test` — runs backend unit + integration tests
- `npm run test:unit` — runs backend unit tests only
- `npm run test:integration` — runs backend integration tests only
- `npm run auth:magic-link -- --email <user-email>` — prints a local magic-link callback URL/token for an ACTIVE event player

## Available placeholder endpoints

- `GET /health`
- `GET /ready`
- `GET /api/events`
- `GET /api/events/current`
- `GET /api/events/:eventId`
- `GET /api/events/:eventId/players/:playerId/race-state`
- `POST /api/events/:eventId/players/:playerId/hazard-status`
- `GET /api/events/:eventId/leaderboard`
- `POST /api/players`
- `GET /api/players/:playerId`
- `PUT /api/players/:playerId`
- `POST /api/teams`
- `GET /api/teams/:teamId`
- `POST /api/teams/:teamId/join`
- `GET /api/teams/:teamId/members`
- `POST /api/hazards/scan`
- `GET /api/hazards/:hazardId`
- `GET /api/events/:eventId/hazards`
- `POST /api/rescue/initiate`
- `GET /api/rescue/:playerId/status`
- `POST /api/rescue/:playerId/complete`

## Next implementation steps

- Replace placeholder service data with Prisma-backed repositories
- Add Auth.js session validation middleware
- Introduce observability hooks for PostHog/OpenTelemetry
- Keep shared frontend/backend contracts in `packages/api-contract`
