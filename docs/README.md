# Documentation

Quick navigation for all project documentation organized by theme.

## 📚 Architecture & Design

- **[Architecture Decision Records](./adr/README.md)** — Concise decision log for the architecture choices currently shaping the repo

- **[Repository Guidelines & Architecture](./architecture/AGENTS.md)** — Code organization, coding standards, service layer patterns
- **[Tech Stack Needed](./architecture/Tech%20Stack%20Needed.md)** — Planned infrastructure and backend architecture
- **[RepoStructure](./architecture/RepoStructure.md)** — Repository organization and conventions
- **[Admin QR Inventory Flow](./architecture/admin-qr-inventory-flow.md)** — Admin QR create/status/delete contract, n8n QR generation handshake, and soft-delete behavior
- **[Admin Race Control + Helios + Audit Flow](./architecture/admin-race-control-helios-audit-flow.md)** — Global pause/resume, Helios role assignment, and event-scoped admin audit behavior for issue #26
- **[Realtime Event Contract](./architecture/realtime-event-contract.md)** — Typed event envelope, channel boundaries, and ordering/idempotency rules for #50/#49
- **[Team Activity Feed](./architecture/team-activity-feed.md)** — Race Hub team timeline model for onboarding + scan outcomes and polling delivery
- **[Assignment and Identity Rulebook](./architecture/assignment-identity-rulebook.md)** — Canonical `workEmail` identity, assignment-state mapping, roster/admin rules, and auth-routing contract for #44/#12/#14

## 📖 Product & Requirements

- **[Velocity GP BDD Specifications](./product/Velocity%20GP%20BDD%20Specifications.md)** — Game rules, mechanics, and scenarios (source of truth)
- **[Player Flow Mermaid Diagrams](./product/player-flow-diagrams.md)** — Detailed player journey, scan/rescue decisions, and team state transitions
- **[Personas](./product/persona/)** — User personas and use cases
  - [Player/Event Attendee](./product/persona/player-event-attendee.md)
  - [Admin/Event Organizer](./product/persona/admin-event-organizer.md)
  - [Display Board Venue](./product/persona/display-board-venue-visuals.md)
  - [Gen AI Announcer](./product/persona/gen-ai-announcer.md)
  - [Helios Player App Creator](./product/persona/helios-player-app-creator.md)
  - [System Backend Sync](./product/persona/system-backend-sync.md)

## 🎨 Design

- **[Figma Design Prompt](./design/Figma%20Design%20Prompt.md)** — Design system and UI component specifications

## 👥 Contributing

- **[DEVELOPMENT.md](../DEVELOPMENT.md)** — Setup, conventions, and development workflow
- **[CONTRIBUTING](./contributing/CONTRIBUTING.md)** — Contribution process and guidelines
- **[ATTRIBUTIONS](./contributing/ATTRIBUTIONS.md)** — Project credits and acknowledgments

## 🚀 Getting Started

1. New to the project? Start with [DEVELOPMENT.md](../DEVELOPMENT.md)
2. Want to understand the game? Read [Velocity GP BDD Specifications](./product/Velocity%20GP%20BDD%20Specifications.md)
3. Building a feature? Check [CONTRIBUTING](./contributing/CONTRIBUTING.md)
4. Need design context? See [Figma Design Prompt](./design/Figma%20Design%20Prompt.md)

---

**Tip**: All docs support relative paths and links. Use them to navigate! 🗺️
