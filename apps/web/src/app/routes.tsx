import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import Login from './pages/Login';
import Garage from './pages/Garage';
import RaceHub from './pages/RaceHub';
import PitStop from './pages/PitStop';
import HeliosProfile from './pages/HeliosProfile';
import Leaderboard from './pages/Leaderboard';
import VictoryLane from './pages/VictoryLane';
import RootLayout from './layouts/RootLayout';
import AdminLayout from './layouts/AdminLayout';
import AdminRouteGuard from './components/auth/AdminRouteGuard';
import AdminGameControl from './pages/admin/AdminGameControl';
import AdminQrCodes from './pages/admin/AdminQrCodes';
import AdminTeams from './pages/admin/AdminTeams';
import AdminPlayers from './pages/admin/AdminPlayers';
import AdminStatistics from './pages/admin/AdminStatistics';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: Login,
  },
  {
    path: '/garage',
    Component: Garage,
  },
  {
    path: '/',
    Component: RootLayout,
    children: [
      { path: 'race-hub', Component: RaceHub },
      { path: 'pit-stop', Component: PitStop },
      { path: 'helios', Component: HeliosProfile },
      { path: 'leaderboard', Component: Leaderboard },
      { path: 'victory-lane', Component: VictoryLane },
    ],
  },
  {
    path: '/admin',
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
