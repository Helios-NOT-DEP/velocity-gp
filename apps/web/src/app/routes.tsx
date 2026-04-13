import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import Login from './pages/Login';
import LoginCallback from './pages/LoginCallback';
import Garage from './pages/Garage';
import RaceHub from './pages/RaceHub';
import PitStop from './pages/PitStop';
import HeliosProfile from './pages/HeliosProfile';
import Leaderboard from './pages/Leaderboard';
import DisplayBoard from './pages/DisplayBoard';
import VictoryLane from './pages/VictoryLane';
import WaitingAssignment from './pages/WaitingAssignment';
import RootLayout from './layouts/RootLayout';
import AdminLayout from './layouts/AdminLayout';
import AdminRouteGuard from './components/auth/AdminRouteGuard';
import HeliosRouteGuard from './components/auth/HeliosRouteGuard';
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
  // Legacy alias: preserve older /garage links while canonical path is /team-setup.
  {
    path: '/garage',
    element: <Navigate to="/team-setup" replace />,
  },
  // Legacy alias: preserve older /race-hub links while canonical path is /race.
  {
    path: '/race-hub',
    element: <Navigate to="/race" replace />,
  },
  {
    path: '/waiting-assignment',
    Component: WaitingAssignment,
  },
  // Venue display board is intentionally public and passive for large-format screens.
  {
    path: '/display',
    Component: DisplayBoard,
  },
  // Team setup remains a standalone pre-race screen outside the bottom-nav layout shell.
  {
    path: '/team-setup',
    element: (
      <ProtectedRouteGuard>
        <Garage />
      </ProtectedRouteGuard>
    ),
  },
  // Pathless layout wrapper: ProtectedRouteGuard + RootLayout applied to all in-race routes.
  // Using a pathless route (no `path` key) avoids the duplicate '/' that would otherwise
  // shadow the Login route above and cause ambiguous route matching.
  {
    element: (
      <ProtectedRouteGuard>
        <RootLayout />
      </ProtectedRouteGuard>
    ),
    children: [
      // In-race player navigation rendered with persistent bottom navigation.
      { path: 'race', Component: RaceHub },
      { path: 'pit-stop', Component: PitStop },
      {
        path: 'helios',
        element: (
          <HeliosRouteGuard>
            <HeliosProfile />
          </HeliosRouteGuard>
        ),
      },
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
      { path: 'teams/:teamId', Component: AdminTeams },
      { path: 'players', Component: AdminPlayers },
      { path: 'players/:playerId', Component: AdminPlayers },
      { path: 'statistics', Component: AdminStatistics },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
