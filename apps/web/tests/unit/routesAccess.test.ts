import { describe, expect, it, vi } from 'vitest';

vi.mock('react-router', () => {
  return {
    createBrowserRouter: vi.fn(() => ({})),
    Navigate: () => null,
  };
});

describe('route access configuration', () => {
  it('keeps /waiting-assignment publicly reachable for assignment-required callbacks', async () => {
    const { appRoutes } = await import('@/app/routes');

    const waitingRoute = appRoutes.find((route) => route.path === '/waiting-assignment');

    expect(waitingRoute).toBeDefined();
    expect(waitingRoute?.Component).toBeDefined();
    expect(waitingRoute?.element).toBeUndefined();
  }, 20_000);

  it('keeps /display publicly reachable for venue boards', async () => {
    const { appRoutes } = await import('@/app/routes');

    const displayRoute = appRoutes.find((route) => route.path === '/display');

    expect(displayRoute).toBeDefined();
    expect(displayRoute?.Component).toBeDefined();
    expect(displayRoute?.element).toBeUndefined();
  }, 20_000);
});
