import { createRoot } from 'react-dom/client';
import App from './app/App';
import { initializeObservability } from './services/observability';
import './styles/index.css';

initializeObservability();

createRoot(document.getElementById('root')!).render(<App />);
