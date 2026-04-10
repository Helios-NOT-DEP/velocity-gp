import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import Login from './pages/Login';
import LoginCallback from './pages/LoginCallback';
import Garage from './pages/Garage';
import RaceHub from './pages/RaceHub';
import PitStop from './pages/PitStop';
import HeliosProfile from './pages/HeliosProfile';
import Leaderboard from './pages/Leaderboard';
import VictoryLane from './pages/VictoryLane';
import WaitingAssignment from './pages/WaitingAssignment';
import RootLayout from './layouts/RootLayout';
import AdminLayout from './layouts/AdminLayout';
import AdminRouteGuard from './components/auth/AdminRouteGuard';
import ProtectedRouteGuard from './components/auth/ProtectedRouteGuard';
import AdminGameControl from './pages/admin/AdminGameControl';
import AdminQrCodes from './pages/admin/AdminQrCodes';
import AdminTeams from './pages/admin/AdminTeams';
import AdminPlayers from './pages/admin/AdminPlayers';
import AdminStatistics from './pages/admin/AdminStatistics';

export const appRoutes: RouteObject[] = [
  // Public auth entrypoint.
  {
    path: '/',
    Component: Login,
  },
  // TODO(figma-sync): Reconcile auth callback/waiting routes with the simplified Figma route map so the designed entry flow and production auth flow do not diverge unexpectedly. | Figma source: src/app/routes.ts (Login -> Garage baseline) | Impact: user flow
  {
    path: '/login/callback',
    Component: LoginCallback,
  },
  {
    path: '/signup',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/waiting-assignment',
    Component: WaitingAssignment,
  },
  // Garage remains a standalone pre-race screen outside the bottom-nav layout shell.
  {
    path: '/garage',
    element: (
      <ProtectedRouteGuard>
        <Garage />
      </ProtectedRouteGuard>
    ),
  },
  // TODO(figma-sync): Add /team route parity for post-Garage handoff; Figma flow routes Garage -> TeamPage before Race Hub. | Figma source: src/app/routes.ts (/team -> TeamPage) | Impact: user flow
  {
    path: '/',
    element: (
      <ProtectedRouteGuard>
        <RootLayout />
      </ProtectedRouteGuard>
    ),
    children: [
      // In-race player navigation rendered with persistent bottom navigation.
      { path: 'race-hub', Component: RaceHub },
      { path: 'pit-stop', Component: PitStop },
      { path: 'helios', Component: HeliosProfile },
      { path: 'leaderboard', Component: Leaderboard },
      { path: 'victory-lane', Component: VictoryLane },
    ],
  },
  // TODO(figma-sync): Reconcile split nested admin sections with the single-screen /admin contract in Figma Make to preserve expected admin navigation behavior. | Figma source: src/app/routes.ts (/admin -> Admin) | Impact: admin flow
  {
    path: '/admin',
    // Guard once at layout level so all nested admin tabs share the same auth gate.
    element: (
      <AdminRouteGuard>
        <AdminLayout />
      </AdminRouteGuard>
    ),
    children: [
      { index: true, element: <Navigate to="game-control" replace /> },
      { path: 'game-control', Component: AdminGameControl },
      { path: 'qr-codes', Component: AdminQrCodes },
      { path: 'teams', Component: AdminTeams },
      { path: 'players', Component: AdminPlayers },
      { path: 'statistics', Component: AdminStatistics },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
