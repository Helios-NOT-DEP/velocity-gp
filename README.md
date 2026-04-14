# Velocity GP

Velocity GP is a TypeScript monorepo for a multi-day endurance game experience. It includes a React web app, an Express BFF API, shared API contracts/client packages, and shared UI primitives.

## Monorepo Layout

```
apps/
  web/                  # React + Vite frontend
  api/                  # Express BFF + Prisma

packages/
  api-contract/         # Shared endpoints, schemas, contracts, domain types
  api-client/           # Reusable typed HTTP client
  ui/                   # Shared React UI primitives
  config-typescript/    # Shared TS config presets

docs/                   # Product, architecture, design, and contribution docs
```

## Prerequisites

- Node.js 18+
- npm 9+
- Docker (for local Postgres)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create local env files:

```bash
cp .env.example .env.local
cp apps/api/.env.example apps/api/.env
```

3. Start local Postgres:

```bash
docker compose up -d
```

Default local database from `docker-compose.yml`:
- host: `localhost`
- port: `16432`
- user: `postgres`
- password: `postgres`
- db: `velocitygp`

4. Run Prisma migrations and seed data:

```bash
npm run db:deploy
npm run db:seed
```

5. Start development:

```bash
npm run dev
```

Local URLs:
- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- API prefix: `/api`

## Scripts

Root scripts:

- `npm run dev` - run all workspaces in watch mode
- `npm run dev:web` - run contract/client/ui + web only
- `npm run dev:api` - run contract + api only
- `npm run build` - build all workspaces
- `npm run build:web` - build web-related workspaces
- `npm run build:api` - build api-related workspaces
- `npm run lint` - lint all workspaces
- `npm test` - run tests across workspaces
- `npm run test:api:unit` - run API unit tests
- `npm run test:api:integration` - run API integration tests
- `npm run test:web:unit` - run web unit tests
- `npm run test:web:component` - run web component tests
- `npm run test:web:e2e` - run web end-to-end tests (Playwright)
- `npm run format` - format `apps/web`
- `npm run db:generate` - generate Prisma client
- `npm run db:deploy` - apply migrations
- `npm run db:migrate` - create/apply dev migration
- `npm run db:studio` - open Prisma Studio
- `npm run db:seed` - seed local database

## API Surface (Current)

Health routes:
- `GET /health`
- `GET /ready`

API routes are mounted under `/api` and currently include:

- Events: `/events`, `/events/current`, `/events/:eventId`
- Game: `/events/:eventId/players/:playerId/race-state`, `/events/:eventId/players/:playerId/hazard-status`, `/events/:eventId/leaderboard`
- Players: `/players`, `/players/:playerId`
- Teams: `/teams`, `/teams/:teamId`, `/teams/:teamId/join`, `/teams/:teamId/members`
- Hazards: `/hazards/scan`, `/hazards/:hazardId`, `/events/:eventId/hazards`
- Rescue: `/rescue/initiate`, `/rescue/:playerId/status`, `/rescue/:playerId/complete`
- Scans: `/events/:eventId/scans`
- Admin (guarded by `requireAdmin`): `/admin/session`, `/admin/events/:eventId/race-control`, `/admin/events/:eventId/teams/:teamId/pit-control`, `/admin/users/:userId/helios-role`, `/admin/events/:eventId/audits`

## Key Documentation

- Development workflow: [DEVELOPMENT.md](./DEVELOPMENT.md)
- Docs index: [docs/README.md](./docs/README.md)
- Product spec: [Velocity GP BDD Specifications](./docs/product/Velocity%20GP%20BDD%20Specifications.md)
- Architecture overview: [RepoStructure](./docs/architecture/RepoStructure.md)
- Planned stack direction: [Tech Stack Needed](./docs/architecture/Tech%20Stack%20Needed.md)
- Observability: [observability.md](./docs/architecture/observability.md)
- Contributing: [CONTRIBUTING.md](./docs/contributing/CONTRIBUTING.md)

## Contributors

Thank you to everyone who has contributed to Velocity GP.

<!-- readme: contributors -start -->
<table>
	<tbody>
		<tr>
            <td align="center">
                <a href="https://github.com/neerpatel">
                    <img src="https://avatars.githubusercontent.com/u/1582261?v=4" width="100;" alt="neerpatel"/>
                    <br />
                    <sub><b>Neer Patel</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/dannydjg16">
                    <img src="https://avatars.githubusercontent.com/u/21086409?v=4" width="100;" alt="dannydjg16"/>
                    <br />
                    <sub><b>Daniel Grant</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/rm-potato">
                    <img src="https://avatars.githubusercontent.com/u/32198503?v=4" width="100;" alt="rm-potato"/>
                    <br />
                    <sub><b>Ryan Milton</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/jn-anki">
                    <img src="https://avatars.githubusercontent.com/u/179261691?v=4" width="100;" alt="jn-anki"/>
                    <br />
                    <sub><b>jn-anki</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/MiloWical">
                    <img src="https://avatars.githubusercontent.com/u/20027643?v=4" width="100;" alt="MiloWical"/>
                    <br />
                    <sub><b>MiloWical</b></sub>
                </a>
            </td>
		</tr>
	<tbody>
</table>
<!-- readme: contributors -end -->

See the full list: [Contributors Graph](https://github.com/Helios-NOT-DEP/velocity-gp/graphs/contributors).

## Notes

- The API uses shared contracts/schemas from `packages/api-contract`.
- Env loading for API supports repo-level and package-level `.env`/`.env.local` files.
- Do not commit local env files.
