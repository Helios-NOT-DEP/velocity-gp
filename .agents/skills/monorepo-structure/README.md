# Monorepo Structure Skill

## Location

`.agents/skills/monorepo-structure/SKILL.md`

## Purpose

Guides users through structuring React + TypeScript fullstack monorepos with pnpm and Turborepo, including Prisma ORM integration.

## Trigger Keywords

"monorepo structure", "fullstack", "pnpm workspaces", "Turborepo", "apps packages separation", "shared contracts", "API architecture", "PostgreSQL"

## What It Covers

### Main SKILL.md

- Complete and minimal tree structures
- Clean dependency rules (what can import what)
- Prisma ORM integration pattern
- Feature organization (inside both frontend and backend)
- Tooling setup (pnpm, Turbo, TypeScript configs)
- Naming conventions and anti-patterns

### Reference Documents

1. **prisma-orm.md** — Deep Prisma setup, repository pattern, DTOs, migrations, serverless, testing
2. **migration-decisions.md** — Moving from single-app to monorepo, BFF vs generic backend, config patterns
3. **best-practices.md** — Golden rules, dependency trees, testing architecture, env strategy, debugging
4. **checklists-templates.md** — Setup checklists, minimal quickstart, package templates, GitHub Actions CI

## How to Use It

In a chat, users can:

- Ask monorepo setup questions
- Trigger with `/monorepo-structure` after typing `/` in chat
- Ask for specific patterns (e.g., "How do I structure Prisma in a monorepo?")
- Reference specific decision points (BFF vs backend, when to split repos)

## Adjacent Contexts

- Velocity-GP project uses a split structure (frontend in root, backend in `backend/`), not a full monorepo
- Skill is project-level (applies to repo), not user-level
- Prisma usage specifically documented for frontend-backend sharing patterns
