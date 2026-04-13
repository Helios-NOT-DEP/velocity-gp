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
    await page.goto('/team-setup');

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

    await page.goto('/team-setup');

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

    await expect(page).toHaveURL(/\/race$/);
  });

  test('redirects legacy aliases to canonical player paths', async ({ page }) => {
    await seedAuthSession(page, {
      userId: 'player-1',
      role: 'player',
      isAuthenticated: true,
      email: 'player@example.com',
    });

    await page.goto('/garage');
    await expect(page).toHaveURL(/\/team-setup$/);

    await page.goto('/race-hub');
    await expect(page).toHaveURL(/\/race$/);
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

    await page.route('**/api/events/current/players/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            eventId: 'event-velocity-active',
            playerId: 'player-1',
            teamId: 'team-apex-comets',
            teamName: 'Apex Comets',
            teamStatus: 'ACTIVE',
            pitStopExpiresAt: null,
            email: 'lina@velocitygp.dev',
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

    await page.goto('/race');
    await page.getByRole('button', { name: 'Start Camera Scan' }).click();

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

  test('Helios user sees their Superpower QR on the profile page', async ({ page }) => {
    await seedAuthSession(page, {
      userId: 'helios-e2e-user-1',
      role: 'helios',
      isAuthenticated: true,
      email: 'helios-e2e@velocitygp.app',
    });

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            userId: 'helios-e2e-user-1',
            playerId: 'player-helios-e2e-1',
            role: 'helios',
            email: 'helios-e2e@velocitygp.app',
            displayName: 'Helios Creator',
            capabilities: { heliosMember: true, player: true, admin: false },
          },
        }),
      });
    });

    await page.route('**/api/players/player-helios-e2e-1/superpower-qr', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            asset: {
              id: 'qr-e2e-1',
              userId: 'helios-e2e-user-1',
              payload: 'VG-SP-E2E001',
              qrImageUrl: 'https://cdn.velocitygp.app/qr/e2e-superpower.png',
              status: 'ACTIVE',
              createdAt: '2026-04-12T00:00:00.000Z',
              regeneratedAt: null,
            },
          },
        }),
      });
    });

    await page.goto('/helios');

    // Profile heading and Superpower QR section should be visible.
    await expect(page.getByText('Rescue QR Code')).toBeVisible();

    // The QR image should be rendered with the mocked URL.
    const qrImage = page.getByRole('img', { name: /Superpower QR/i });
    await expect(qrImage).toBeVisible();
    await expect(qrImage).toHaveAttribute(
      'src',
      'https://cdn.velocitygp.app/qr/e2e-superpower.png'
    );

    // Regenerate button should be present and enabled.
    await expect(page.getByRole('button', { name: /Regenerate Superpower QR/i })).toBeEnabled();
  });

  test('non-Helios player is redirected away from the Helios profile', async ({ page }) => {
    await seedAuthSession(page, {
      userId: 'player-e2e-regular-1',
      role: 'player',
      isAuthenticated: true,
      email: 'player-e2e@velocitygp.app',
    });

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            userId: 'player-e2e-regular-1',
            playerId: 'player-e2e-regular-1',
            role: 'player',
            email: 'player-e2e@velocitygp.app',
            displayName: 'Regular Player',
            capabilities: { heliosMember: false, player: true, admin: false },
          },
        }),
      });
    });

    await page.goto('/helios');

    // Should not see the profile QR section — redirect occurs.
    await expect(page.getByText('Rescue QR Code')).not.toBeVisible({ timeout: 3000 });
  });
});
