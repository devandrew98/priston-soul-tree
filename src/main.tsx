import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { StoreProvider } from './store';
import { LanguageProvider } from './lib/i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </LanguageProvider>
  </StrictMode>,
);
