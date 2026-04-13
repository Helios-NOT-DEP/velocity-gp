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

  test('loads public display board route and refreshes standings without auth', async ({
    page,
  }) => {
    let leaderboardCallCount = 0;

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'TEST_NON_AUTHORITATIVE_AUTH',
          },
        }),
      });
    });

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

    await page.route('**/api/events/event-velocity-active/leaderboard', async (route) => {
      leaderboardCallCount += 1;
      const leaderScore = leaderboardCallCount > 1 ? 1600 : 1500;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              rank: 1,
              teamId: 'team-apex',
              teamName: 'Apex Meteors',
              score: leaderScore,
              memberCount: 4,
              status: 'ACTIVE',
            },
            {
              rank: 2,
              teamId: 'team-ultras',
              teamName: 'Risk Racers',
              score: 1420,
              memberCount: 4,
              status: 'IN_PIT',
            },
            {
              rank: 3,
              teamId: 'team-drift',
              teamName: 'Drift Unit',
              score: 1390,
              memberCount: 3,
              status: 'ACTIVE',
            },
            {
              rank: 4,
              teamId: 'team-nova',
              teamName: 'Nova Crew',
              score: 1300,
              memberCount: 4,
              status: 'ACTIVE',
            },
          ],
        }),
      });
    });

    await page.goto('/display');

    await expect(page.getByRole('heading', { name: 'Main Stage Display Board' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Apex Meteors' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Top 3 Teams' }).getByText('1,500')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scanner' })).toHaveCount(0);

    await expect
      .poll(() => leaderboardCallCount, { timeout: 12_000, message: 'expected second poll call' })
      .toBeGreaterThan(1);
    await expect(
      page.getByRole('region', { name: 'Top 3 Teams' }).getByText('1,600')
    ).toBeVisible();
  });

  test('renders display storytelling states for overtake, pit alert, and repairs complete', async ({
    page,
  }) => {
    let leaderboardCallCount = 0;
    let displayEventsCallCount = 0;

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            code: 'TEST_NON_AUTHORITATIVE_AUTH',
          },
        }),
      });
    });

    await page.route('**/api/events/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'event-display-story',
          },
        }),
      });
    });

    await page.route('**/api/events/event-display-story/leaderboard', async (route) => {
      leaderboardCallCount += 1;

      if (leaderboardCallCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                rank: 1,
                teamId: 'team-alpha',
                teamName: 'Team Alpha',
                score: 1600,
                memberCount: 4,
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
              {
                rank: 2,
                teamId: 'team-beta',
                teamName: 'Team Beta',
                score: 1500,
                memberCount: 4,
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
              {
                rank: 3,
                teamId: 'team-epsilon',
                teamName: 'Team Epsilon',
                score: 1450,
                memberCount: 4,
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
              {
                rank: 4,
                teamId: 'team-gamma',
                teamName: 'Team Gamma',
                score: 1380,
                memberCount: 4,
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
              {
                rank: 5,
                teamId: 'team-delta',
                teamName: 'Team Delta',
                score: 1320,
                memberCount: 4,
                status: 'ACTIVE',
                pitStopExpiresAt: null,
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              rank: 1,
              teamId: 'team-alpha',
              teamName: 'Team Alpha',
              score: 1600,
              memberCount: 4,
              status: 'ACTIVE',
              pitStopExpiresAt: null,
            },
            {
              rank: 2,
              teamId: 'team-beta',
              teamName: 'Team Beta',
              score: 1500,
              memberCount: 4,
              status: 'ACTIVE',
              pitStopExpiresAt: null,
            },
            {
              rank: 3,
              teamId: 'team-epsilon',
              teamName: 'Team Epsilon',
              score: 1450,
              memberCount: 4,
              status: 'ACTIVE',
              pitStopExpiresAt: null,
            },
            {
              rank: 4,
              teamId: 'team-delta',
              teamName: 'Team Delta',
              score: 1410,
              memberCount: 4,
              status: 'IN_PIT',
              pitStopExpiresAt: '2030-04-13T02:15:00.000Z',
            },
            {
              rank: 5,
              teamId: 'team-gamma',
              teamName: 'Team Gamma',
              score: 1385,
              memberCount: 4,
              status: 'ACTIVE',
              pitStopExpiresAt: null,
            },
          ],
        }),
      });
    });

    await page.route('**/api/events/event-display-story/display-events**', async (route) => {
      displayEventsCallCount += 1;

      if (displayEventsCallCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              items: [],
              nextCursor: null,
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 'transition-1',
                eventId: 'event-display-story',
                teamId: 'team-delta',
                teamName: 'Team Delta',
                type: 'TEAM_ENTERED_PIT',
                reason: 'HAZARD_TRIGGER',
                occurredAt: '2030-04-13T02:00:01.000Z',
              },
              {
                id: 'transition-2',
                eventId: 'event-display-story',
                teamId: 'team-delta',
                teamName: 'Team Delta',
                type: 'TEAM_REPAIRS_COMPLETE',
                reason: 'RESCUE_CLEARED',
                occurredAt: '2030-04-13T02:00:02.000Z',
              },
            ],
            nextCursor: '2030-04-13T02:00:02.000Z|transition-2',
          },
        }),
      });
    });

    await page.goto('/display');

    await expect(page.getByRole('heading', { name: 'Main Stage Display Board' })).toBeVisible();
    await expect
      .poll(() => leaderboardCallCount, {
        timeout: 12_000,
        message: 'expected second leaderboard poll for overtake state',
      })
      .toBeGreaterThan(1);
    await expect(page.locator('[data-team-id="team-delta"]')).toHaveClass(/ring-2/, {
      timeout: 12_000,
    });
    await expect(page.locator('[aria-label="Pit entry alert"]')).toBeVisible({ timeout: 14_000 });
    const repairsBanner = page.getByRole('status').filter({ hasText: 'REPAIRS COMPLETE' });
    await expect(repairsBanner).toBeVisible({ timeout: 18_000 });
    await expect(repairsBanner).toContainText('Team Delta is back on track.');
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
            session: {
              userId: 'helios-e2e-user-1',
              playerId: 'player-helios-e2e-1',
              role: 'helios',
              isAuthenticated: true,
              email: 'helios-e2e@velocitygp.app',
              displayName: 'Helios Creator',
              capabilities: { heliosMember: true, player: true, admin: false },
            },
          },
        }),
      });
    });

    await page.route('**/api/rescue/log**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { rescues: [] },
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
            session: {
              userId: 'player-e2e-regular-1',
              playerId: 'player-e2e-regular-1',
              role: 'player',
              isAuthenticated: true,
              email: 'player-e2e@velocitygp.app',
              displayName: 'Regular Player',
              capabilities: { heliosMember: false, player: true, admin: false },
            },
          },
        }),
      });
    });

    await page.goto('/helios');

    // Should not see the profile QR section — redirect occurs.
    await expect(page.getByText('Rescue QR Code')).not.toBeVisible({ timeout: 3000 });
  });
});
