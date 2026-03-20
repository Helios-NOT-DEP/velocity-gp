import { createBrowserRouter } from 'react-router';
import Login from './pages/Login';
import Garage from './pages/Garage';
import RaceHub from './pages/RaceHub';
import PitStop from './pages/PitStop';
import HeliosProfile from './pages/HeliosProfile';
import Leaderboard from './pages/Leaderboard';
import VictoryLane from './pages/VictoryLane';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Login,
  },
  {
    path: '/garage',
    Component: Garage,
  },
  {
    path: '/race-hub',
    Component: RaceHub,
  },
  {
    path: '/pit-stop',
    Component: PitStop,
  },
  {
    path: '/helios',
    Component: HeliosProfile,
  },
  {
    path: '/leaderboard',
    Component: Leaderboard,
  },
  {
    path: '/victory-lane',
    Component: VictoryLane,
  },
]);
