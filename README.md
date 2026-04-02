# Velocity GP

Velocity GP is a React + TypeScript + Vite application for a multi-day endurance-style event experience. The product combines attendee gameplay, team identity creation, QR-based scanning mechanics, Helios rescue flows, leaderboard-style race dynamics, and planned admin and backend capabilities documented in the repo.

## Repository Overview

The current repository contains the attendee-facing frontend and an Express-based backend-for-frontend (BFF). The frontend includes route-level screens for the attendee experience, shared game state via React context, reusable UI primitives, and supporting design and product documentation for planned expansion. The backend currently exposes placeholder endpoints that mirror the planned API contract so future auth, persistence, and integrations can be added cleanly.

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

## Documentation

Quick links to key docs (full index in [docs/README.md](./docs/README.md)):

- **Setup & Contributing**: [DEVELOPMENT.md](./DEVELOPMENT.md)
- **Product Spec**: [BDD Specifications](./docs/product/Velocity%20GP%20BDD%20Specifications.md)
- **Architecture**: [Tech Stack Needed](./docs/architecture/Tech%20Stack%20Needed.md)
- **Design System**: [Figma Design Prompt](./docs/design/Figma%20Design%20Prompt.md)
- **Personas**: [Player, Admin, AI Announcer, etc.](./docs/product/persona/)
- **Testing**: [tests/README.md](./tests/README.md)

## Backlog and Workflow

GitHub Issues is the backlog of record for this project. Planned work is tracked in the Helios project board:

- `https://github.com/orgs/Helios-NOT-DEP/projects/4`

When implementing features, keep documentation and code aligned with the relevant GitHub Issue, the BDD persona specs, and the planned stack.

## Development

**For full setup instructions, conventions, and workflow see [DEVELOPMENT.md](./DEVELOPMENT.md).**

Quick start:

```bash
npm install
npm --prefix backend install
npm run dev        # Start dev server at http://localhost:5173
npm run api:dev    # Start the backend BFF at http://localhost:4000
npm run dev:all    # Start both services together
npm run build      # Create production bundle
npm run lint       # Check code style
npm test          # Run test suite
```

## Project Structure

```
src/
  ├── app/              # Pages, layouts, and React components
  ├── components/       # Reusable UI primitives and design components
  ├── services/         # Business logic (auth, API, game)
  ├── models/           # Domain types (Player, Team, Race, etc.)
  ├── hooks/            # Custom React hooks
  ├── utils/            # Helper functions
  ├── db/               # Database (Prisma) configuration
  └── styles/           # Tailwind and theme styles

docs/                   # Complete documentation (see docs/README.md)
tests/                  # Automated tests
scripts/                # Development scripts
backend/                # Express BFF with placeholder endpoints
.mcp/                   # Model Context Protocol config
```

## Implementation Guidance

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed conventions. Key principles:

- ✅ Reuse UI primitives from `src/app/components/ui/` before adding new patterns
- ✅ Keep route concerns in pages, share logic via services or custom hooks
- ✅ Use typed interfaces for clear boundaries (auth, API, state)
- ✅ Align with the planned stack for future backend integration
- ❌ Avoid: UI components coupled to backend providers, hardcoded config values
