import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { GameProvider } from './context/GameContext';
import { observeRouter } from '@/services/observability/router';

export default function App() {
  useEffect(() => {
    // Register route observers once so navigation telemetry is captured centrally.
    return observeRouter(router);
  }, []);

  return (
    // GameProvider wraps the entire router so route screens can share game/session state.
    <GameProvider>
      <RouterProvider router={router} />
    </GameProvider>
  );
}
