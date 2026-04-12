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
