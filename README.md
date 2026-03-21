# Velocity GP

Velocity GP is a React + TypeScript + Vite application for a multi-day endurance-style event experience. The product combines attendee gameplay, team identity creation, QR-based scanning mechanics, Helios rescue flows, leaderboard-style race dynamics, and planned admin and backend capabilities documented in the repo.

## Repository Overview

The current repository is primarily a frontend application. It includes route-level screens for the attendee experience, shared game state via React context, reusable UI primitives, and supporting design and product documentation for planned expansion.

Current route-level pages live in `src/app/pages/` and include:

- `Login`
- `Garage`
- `RaceHub`
- `PitStop`
- `HeliosProfile`
- `Leaderboard`
- `VictoryLane`

## Tech Direction

The planned stack is documented in [docs/Tech Stack Needed.md](./docs/Tech%20Stack%20Needed.md). In summary:

- Frontend: React with TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Infrastructure: DigitalOcean App Platform, DigitalOcean Postgres, and a Droplet for `n8n`
- AI and services: OpenAI, ElevenLabs, and SendGrid
- Authentication: Auth.js email authentication
- Observability: PostHog with OpenTelemetry

## Product and Spec Docs

- [Master BDD Index](./docs/Velocity%20GP%20BDD%20Specifications.md)
- [Persona 1: Player](./docs/persona/player-event-attendee.md)
- [Persona 2: Helios Player](./docs/persona/helios-player-app-creator.md)
- [Persona 3: Admin](./docs/persona/admin-event-organizer.md)
- [Persona 4: System](./docs/persona/system-backend-sync.md)
- [Persona 5: Display Board](./docs/persona/display-board-venue-visuals.md)
- [Persona 6: Gen AI Announcer](./docs/persona/gen-ai-announcer.md)
- [Tech Stack Needed](./docs/Tech%20Stack%20Needed.md)

## Backlog and Workflow

GitHub Issues is the backlog of record for this project. Planned work is tracked in the Helios project board:

- `https://github.com/orgs/Helios-NOT-DEP/projects/4`

When implementing features, keep documentation and code aligned with the relevant GitHub Issue, the BDD persona specs, and the planned stack.

## Development

Install dependencies, then run:

```bash
npm run dev
```

To create a production build:

```bash
npm run build
```

## Project Structure

- `src/app/pages`: route-level screens
- `src/app/components/ui`: reusable UI primitives
- `src/app/components/figma`: design-derived components
- `src/app/context`: shared state and providers
- `src/styles`: Tailwind entry and theme styles
- `docs`: product, architecture, and planning documentation

## Implementation Guidance

- Prefer existing UI primitives before adding new component patterns.
- Keep route concerns in pages and shared logic in reusable modules when reuse is real.
- Preserve typed interfaces and clear boundaries for future auth, data, and service integrations.
- Avoid coupling UI components directly to future backend providers; align with the planned stack instead.
