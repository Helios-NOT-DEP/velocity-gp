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
