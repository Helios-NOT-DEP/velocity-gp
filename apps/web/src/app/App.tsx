import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { GameProvider } from './context/GameContext';
import { observeRouter } from '@/services/observability/router';

export default function App() {
  useEffect(() => {
    return observeRouter(router);
  }, []);

  return (
    <GameProvider>
      <RouterProvider router={router} />
    </GameProvider>
  );
}
