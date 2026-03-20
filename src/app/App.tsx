import { RouterProvider } from 'react-router';
import { router } from './routes';
import { GameProvider } from './context/GameContext';

export default function App() {
  return (
    <GameProvider>
      <RouterProvider router={router} />
    </GameProvider>
  );
}
