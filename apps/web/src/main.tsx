import { createRoot } from 'react-dom/client';
import App from './app/App';
import { initializeObservability } from './services/observability';
import './styles/index.css';

// Boot observability before React mounts so startup/runtime errors are captured.
initializeObservability();

createRoot(document.getElementById('root')!).render(<App />);
