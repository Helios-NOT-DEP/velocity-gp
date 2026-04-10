import { expect, test, type Page } from '@playwright/test';

const AUTH_SESSION_STORAGE_KEY = 'velocitygp.auth.session';

interface AuthSessionSeed {
  readonly userId: string;
  readonly role: 'player' | 'admin' | 'helios';
  readonly isAuthenticated: true;
  readonly email: string;
}

async function seedAuthSession(page: Page, session: AuthSessionSeed) {
  await page.addInitScript(
    ([storageKey, storageValue]) => {
      window.localStorage.setItem(storageKey, JSON.stringify(storageValue));
    },
    [AUTH_SESSION_STORAGE_KEY, session] as const
  );
}

test.describe('Velocity GP web flows', () => {
  test('requests a magic link from the login page', async ({ page }) => {
    await page.route('**/api/auth/magic-link/request', async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            accepted: true,
            message: 'Check your inbox for your secure sign-in link.',
          },
        }),
      });
    });

    await page.goto('/');

    await page.getByPlaceholder('your@email.com').fill('hello@velocitygp.app');
    await page.getByRole('button', { name: 'Email Me a Sign-In Link' }).click();

    await expect(page.getByText('Check your inbox for your secure sign-in link.')).toBeVisible();
  });

  test('shows user-not-found feedback when no player matches email', async ({ page }) => {
    await page.route('**/api/auth/magic-link/request', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'AUTH_USER_NOT_FOUND',
            message: 'No user found for this work email.',
          },
        }),
      });
    });

    await page.goto('/');

    await page.getByPlaceholder('your@email.com').fill('unknown@velocitygp.app');
    await page.getByRole('button', { name: 'Email Me a Sign-In Link' }).click();

    await expect(page.getByText('No user found for this work email.')).toBeVisible();
  });

  test('shows login failure feedback when magic-link request fails', async ({ page }) => {
    await page.route('**/api/auth/magic-link/request', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'server unavailable',
          },
        }),
      });
    });

    await page.goto('/');

    await page.getByPlaceholder('your@email.com').fill('hello@velocitygp.app');
    await page.getByRole('button', { name: 'Email Me a Sign-In Link' }).click();

    await expect(
      page.getByText('Unable to request a sign-in link right now. Please try again.')
    ).toBeVisible();
  });

  test('redirects anonymous users away from admin routes', async ({ page }) => {
    await page.goto('/admin/game-control');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Email Me a Sign-In Link' })).toBeVisible();
  });

  test('redirects anonymous users away from protected non-admin routes', async ({ page }) => {
    await page.goto('/garage');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Email Me a Sign-In Link' })).toBeVisible();
  });

  test('shows forbidden state for authenticated non-admin users', async ({ page }) => {
    await seedAuthSession(page, {
      userId: 'player-1',
      role: 'player',
      isAuthenticated: true,
      email: 'player@example.com',
    });

    await page.goto('/admin/game-control');

    await expect(page.getByText('Admin Access Required')).toBeVisible();
  });

  test('allows authenticated admins to access admin game control', async ({ page }) => {
    await seedAuthSession(page, {
      userId: 'admin-1',
      role: 'admin',
      isAuthenticated: true,
      email: 'admin@example.com',
    });

    await page.goto('/admin/game-control');

    await expect(page.getByRole('heading', { name: 'Game Control' })).toBeVisible();
  });

  test('allows authenticated users to access protected non-admin routes', async ({ page }) => {
    await seedAuthSession(page, {
      userId: 'player-1',
      role: 'player',
      isAuthenticated: true,
      email: 'player@example.com',
    });

    await page.goto('/garage');

    await expect(page.getByRole('heading', { name: 'Create Your Team' })).toBeVisible();
  });

  test('redirects authenticated users away from login page', async ({ page }) => {
    await seedAuthSession(page, {
      userId: 'player-1',
      role: 'player',
      isAuthenticated: true,
      email: 'player@example.com',
    });

    await page.goto('/');

    await expect(page).toHaveURL(/\/race-hub$/);
  });

  test('requests camera access and scans a QR code in Race Hub', async ({ page, context }) => {
    test.slow();

    await context.grantPermissions(['camera'], { origin: 'http://127.0.0.1:4173' });

    await page.addInitScript(() => {
      let cameraRequestCount = 0;
      const mediaDevices = globalThis.navigator?.mediaDevices;
      if (mediaDevices?.getUserMedia) {
        const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
        mediaDevices.getUserMedia = async (...args) => {
          cameraRequestCount += 1;
          (
            globalThis as typeof globalThis & { __cameraRequestCount?: number }
          ).__cameraRequestCount = cameraRequestCount;
          return originalGetUserMedia(...args);
        };
      }

      (globalThis as typeof globalThis & { __cameraRequestCount?: number }).__cameraRequestCount =
        0;
    });

    await seedAuthSession(page, {
      userId: 'player-1',
      role: 'player',
      isAuthenticated: true,
      email: 'lina@velocitygp.dev',
    });

    let scannedPayload: string | null = null;

    await page.route('**/api/events/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'event-velocity-active',
          },
        }),
      });
    });

    await page.route('**/api/events/event-velocity-active/scans', async (route) => {
      const requestPayload = route.request().postDataJSON() as {
        playerId: string;
        qrPayload: string;
      };

      scannedPayload = requestPayload.qrPayload;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            outcome: 'SAFE',
            eventId: 'event-velocity-active',
            playerId: requestPayload.playerId,
            teamId: 'team-apex-comets',
            qrCodeId: 'qr-alpha',
            qrPayload: requestPayload.qrPayload,
            scannedAt: new Date().toISOString(),
            message: 'safe',
            pointsAwarded: 120,
            teamScore: 1000,
            claimCreated: true,
            hazardRatioUsed: 8,
          },
        }),
      });
    });

    await page.goto('/race-hub');

    await page.getByRole('button', { name: 'Start Camera Scan' }).click();
    await expect(page.getByText('Scanner Active')).toBeVisible();

    await page.waitForRequest('**/api/events/event-velocity-active/scans', {
      timeout: 15_000,
    });
    await expect(page.getByText('Scan Registered')).toBeVisible();

    const cameraRequestCount = await page.evaluate(() => {
      return (
        (globalThis as typeof globalThis & { __cameraRequestCount?: number })
          .__cameraRequestCount ?? 0
      );
    });

    expect(cameraRequestCount).toBeGreaterThan(0);
    expect(scannedPayload).toBe('VG-001');
  });
});
