# Tests

Automated test suite for Velocity GP using Vitest and React Testing Library.

## Structure

```
tests/
├── unit/                    # Unit tests for isolated functions
│   ├── utils/              # Utility function tests
│   ├── services/           # Service logic tests
│   └── hooks/              # Custom hook tests
├── integration/            # Integration tests for features
│   └── pages/              # Page/route-level tests
└── fixtures/               # Test data and mocks
```

## Running Tests

```bash
npm test                    # Run all tests
npm test -- --ui            # Run with interactive UI
npm test -- --watch         # Watch mode (re-run on change)
npm test -- --coverage      # Generate coverage report
npm test -- unit/           # Run only unit tests
npm test -- game.test.ts    # Run specific test file
```

## Writing Tests

### Unit Tests

Test isolated functions, utilities, and services:

```typescript
// tests/unit/utils/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { formatRaceTime } from '@/utils/formatters';

describe('formatRaceTime', () => {
  it('formats milliseconds to HH:MM:SS', () => {
    const result = formatRaceTime(3661000); // 1 hour, 1 minute, 1 second
    expect(result).toBe('01:01:01');
  });
});
```

### Component Tests

Test React components with user interactions:

```typescript
// tests/unit/components/button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/app/components/ui/button';

describe('Button', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    
    await userEvent.click(screen.getByText('Click me'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

### Integration Tests

Test feature flows across multiple components:

```typescript
// tests/integration/race-flow.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { RaceHub } from '@/app/pages/RaceHub';
import { GameProvider } from '@/app/context/GameContext';

describe('Race Flow', () => {
  it('displays player stats and race progress', async () => {
    render(
      <GameProvider>
        <RaceHub />
      </GameProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/race progress/i)).toBeInTheDocument();
    });
  });
});
```

## Test Fixtures

Mock data shared across tests:

```typescript
// tests/fixtures/game-state.ts
export const mockPlayer = {
  id: 'player-1',
  email: 'test@example.com',
  name: 'Test Player',
  status: 'RACING',
};

export const mockRaceState = {
  playerId: 'player-1',
  score: 450,
  hazardsEncountered: [],
  status: 'RACING',
};
```

## Best Practices

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names: `it('displays player name when race loads')`
- ✅ Keep tests focused and isolated
- ✅ Mock external dependencies (API calls, services)
- ✅ Use `userEvent` instead of `fireEvent` for interactions
- ❌ Don't test internal state directly
- ❌ Avoid testing UI framework behavior
- ❌ Don't over-mock (test real behavior where possible)

## Debugging Tests

```bash
# Enable debug output
npm test -- --reporter=verbose

# Use debugger in test
it('test name', () => {
  debugger; // Breakpoint
  // test code
});

# Run with Node debugger
node --inspect-brk ./node_modules/vitest/vitest.mjs
```

## Coverage Goals

- **Statements**: 75%+
- **Branches**: 70%+
- **Functions**: 75%+
- **Lines**: 75%+

View coverage report:
```bash
npm test -- --coverage
```

---

Learn more: [Vitest](https://vitest.dev) | [Testing Library](https://testing-library.com)
