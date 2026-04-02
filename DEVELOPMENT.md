# Development Guide

Welcome to Velocity GP! This guide walks you through setting up your development environment and working with the codebase.

## Prerequisites

- **Node.js**: 18+ (verify with `node --version`)
- **npm**: 9+ (verify with `npm --version`)
- **Git**: For version control
- A code editor (VS Code recommended with Copilot extension)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs all required packages including React, TypeScript, Tailwind, Radix UI, and development tools.

To install the new backend package as well, run:

```bash
npm --prefix backend install
```

### 2. Start Development Server

```bash
npm run dev
```

The app opens to `http://localhost:5173` by default. Changes to files are hot-reloaded automatically.

To run both the frontend and backend together:

```bash
npm run dev:all
```

The backend BFF listens on `http://localhost:4000` and serves its API under `/api`.

### 3. Build for Production

```bash
npm run build
```

Creates an optimized bundle in `dist/` ready for deployment.

## Project Structure

```
src/
  ├── app/               # Route pages and layouts
  │   ├── pages/         # Route-level screens
  │   ├── components/    # Reusable UI components
  │   ├── context/       # Shared state (GameContext)
  │   └── routes.ts      # Route definitions
  ├── services/          # Business logic & integrations
  │   ├── auth/          # Authentication
  │   ├── api/           # HTTP client & endpoints
  │   └── game/          # Game mechanics
  ├── models/            # Domain types
  ├── hooks/             # Custom React hooks
  ├── utils/             # Utility functions
  └── styles/            # Global CSS & themes

tests/
  ├── unit/              # Component & utility tests
  ├── integration/       # Page & flow tests
  └── fixtures/          # Mock data

docs/
  ├── architecture/      # Technical decisions & stack
  ├── product/           # BDD specs & personas
  ├── design/            # Design system & Figma
  └── contributing/      # Contribution guidelines
```

## Key Commands

| Command             | Purpose                               |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start development server              |
| `npm run dev:all`   | Start frontend and backend together   |
| `npm run api:dev`   | Start only the backend BFF            |
| `npm run build`     | Build for production                  |
| `npm run api:build` | Build the backend BFF                 |
| `npm run lint`      | Run ESLint                            |
| `npm run format`    | Format code with Prettier             |
| `npm test`          | Run Vitest (unit & integration tests) |
| `npm run api:test`  | Run backend integration tests         |

## Coding Conventions

### TypeScript

- Use functional components with hooks (no classes)
- Prefer explicit types over `any`
- Use single quotes (`'`) in `.ts` and `.tsx` files
- Semicolons required at end of statements

### React

- Reuse UI primitives from `src/app/components/ui/` before creating new ones
- Keep state in `GameContext` for app-wide data
- Extract page-specific logic to services or custom hooks
- Use the `@/` alias for imports: `import { Button } from '@/app/components/ui/button'`

### Styling

- Use Tailwind CSS for all styling
- Reference existing theme in `src/styles/theme.css`
- Keep consistency with existing design patterns
- Responsive design first (mobile → desktop)

## Working with Services

Services are organized into three domains:

### Authentication (`src/services/auth/`)

Handle user login, signup, and session management.

```typescript
import { signIn, getSession } from '@/services/auth';

const user = await signIn({ email: 'user@example.com' });
```

### API (`src/services/api/`)

HTTP client for backend communication.

```typescript
import { apiClient, gameEndpoints } from '@/services/api';

const response = await apiClient.get(gameEndpoints.getRaceState(eventId, playerId));
```

### Game (`src/services/game/`)

Core game mechanics and calculations.

```typescript
import { getRaceState, calculateScore } from '@/services/game';

const raceState = await getRaceState(eventId, playerId);
const score = calculateScore(100, hazards);
```

## Testing

Tests live alongside features in `tests/`:

```bash
npm test                  # Run all tests
npm test -- --ui          # Run with UI
npm test -- --watch       # Watch mode
npm test -- game.test.ts  # Run specific test
```

Tests should cover:

- ✅ Unit: utils, services, hooks
- ✅ Integration: page flows, API calls
- ❌ Avoid: implementation details, internal state

Prefer `@testing-library/react` patterns:

```typescript
import { render, screen } from '@testing-library/react';

test('button displays label', () => {
  const { getByText } = render(<Button>Click me</Button>);
  expect(getByText('Click me')).toBeInTheDocument();
});
```

## Environment Variables

Copy `.env.example` to `.env.local` and update as needed:

```bash
cp .env.example .env.local
```

| Variable            | Purpose         | Example                     |
| ------------------- | --------------- | --------------------------- |
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:4000/api` |
| `VITE_EVENT_ID`     | Current event   | `event-123`                 |

The backend package has its own `backend/.env.example` file for server-side configuration.

**Never commit `.env.local`** — it's in `.gitignore`.

## Git Workflow

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feat/player-profile
   ```

2. **Make focused commits** with conventional messages:

   ```bash
   git commit -m "feat: add player profile page"
   git commit -m "fix: correct hazard penalty calculation"
   git commit -m "docs: update DEVELOPMENT guide"
   ```

3. **Open a pull request** with:
   - Clear description of changes
   - Link to GitHub Issue if applicable
   - Screenshots for UI changes
   - Test results (`npm run build` passes)

## Debugging

### Browser DevTools

- React DevTools extension: Inspect components and state
- Network tab: Verify API calls
- Console: Check for errors and warnings

### VS Code

- Install **ES7+ React/Redux/React-Native snippets** extension
- Use **Vitest extension** for inline test running
- Debug with **VS Code Debugger** (click line number for breakpoint)

### Common Issues

| Issue                  | Solution                                                  |
| ---------------------- | --------------------------------------------------------- |
| Hot reload not working | Restart `npm run dev`                                     |
| Styles not applying    | Check Tailwind class names, run `npm run build` to verify |
| Import errors          | Verify `@/` alias is in `tsconfig.json`                   |
| Tests failing          | Check mock data in `tests/fixtures/`                      |

## Documentation

- **Product**: [Velocity GP BDD Specifications](docs/product/Velocity%20GP%20BDD%20Specifications.md)
- **Design**: [Figma Design Prompt](docs/design/Figma%20Design%20Prompt.md)
- **Architecture**: [Tech Stack Needed](docs/architecture/Tech%20Stack%20Needed.md)
- **Personas**: [Player Personas](docs/product/persona/)

## Performance Tips

- Use React DevTools Profiler to find slow components
- Lazy load pages with `React.lazy()` and `Suspense`
- Memoize expensive calculations with `useMemo`
- Use `useCallback` for event handlers passed to child components

## Deployment

Deployment is handled by DigitalOcean App Platform (configured in `.do/` folder). See [Tech Stack Needed](docs/architecture/Tech%20Stack%20Needed.md) for details.

## Getting Help

- 📖 Check the [BDD Specifications](docs/product/Velocity%20GP%20BDD%20Specifications.md)
- 🎨 Reference the [Figma Design Prompt](docs/design/Figma%20Design%20Prompt.md)
- 💬 Ask in GitHub Discussions or Issues
- 🐛 File bugs with reproduction steps

---

Happy coding! 🏎️
