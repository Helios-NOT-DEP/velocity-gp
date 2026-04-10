import { describe, expect, it, vi } from 'vitest';

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    createBrowserRouter: vi.fn(() => ({})),
  };
});

describe('route access configuration', () => {
  it('keeps /waiting-assignment publicly reachable for assignment-required callbacks', async () => {
    const [{ appRoutes }, { default: WaitingAssignment }] = await Promise.all([
      import('@/app/routes'),
      import('@/app/pages/WaitingAssignment'),
    ]);

    const waitingRoute = appRoutes.find((route) => route.path === '/waiting-assignment');

    expect(waitingRoute).toBeDefined();
    expect(waitingRoute?.Component).toBe(WaitingAssignment);
    expect(waitingRoute?.element).toBeUndefined();
  });
});
