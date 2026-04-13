# Web Test Suite

Velocity GP web tests are split by test level:

```text
tests/
├── unit/        # Pure logic and service tests (Vitest)
├── component/   # React component/page tests with happy-dom (Vitest + RTL)
├── e2e/         # Browser flows (Playwright)
└── setup/       # Shared test setup
```

## Commands

From the repository root:

```bash
npm run test:web:unit
npm run test:web:component
npm run test:web:e2e
```

From the web workspace:

```bash
npm run test --workspace=@velocity-gp/web
npm run test:unit --workspace=@velocity-gp/web
npm run test:component --workspace=@velocity-gp/web
npm run test:e2e --workspace=@velocity-gp/web
```

## Notes

- `npm run test --workspace=@velocity-gp/web` runs only Vitest suites (`unit` + `component`).
- E2E runs in Playwright with mocked API responses for stable UI-flow coverage.
- Shared setup for Vitest lives at `tests/setup/setupTests.ts`.

## Pit-Stop Smoke Focus

For issue-level validation of pit-stop behavior, ensure the following checks are covered before merge:

- hazard-hit flow routes to `/pit-stop` and displays lockout state immediately
- pit-stop countdown reflects backend `pitStopExpiresAt` refreshes
- scanner stays disabled while team status is `IN_PIT`
- release transition (`teamStatus` leaves `IN_PIT`) returns player to race hub

Recommended sequence:

- run component coverage for pit sync behavior (`pitStopSync.test.tsx`)
- run web E2E flows to validate route-level behavior
- run API integration tests to verify lockout/release invariants remain stable

## Rescue Cooldown + Helios Log Smoke Focus

For issue-level validation of rescue cooldown and Helios visibility behavior, cover:

- Helios rescue initiation sets a 3-minute cooldown window for the rescuer
- repeat rescue attempts during cooldown surface `HELIOS_COOLDOWN_ACTIVE`
- rescue activity section on Helios Profile renders loading/empty/error/populated states
- rescue log entries display latest outcomes in chronological activity order

Recommended sequence:

- run API integration rescue tests (`systemEnforcement.test.ts`) for cooldown and same-team guardrails
- run Helios Profile component tests for rescue log rendering states
- run targeted web E2E only if the Helios profile flow is part of the changed user journey
