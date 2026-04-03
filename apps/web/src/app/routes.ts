import { createBrowserRouter } from 'react-router';
import Signup from './pages/Signup';
import Garage from './pages/Garage';
import RaceHub from './pages/RaceHub';
import PitStop from './pages/PitStop';
import HeliosProfile from './pages/HeliosProfile';
import Leaderboard from './pages/Leaderboard';
import VictoryLane from './pages/VictoryLane';
import RootLayout from './layouts/RootLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Signup,
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
]);
