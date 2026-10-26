import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './theme-medieval.css'; // medieval look (top bar + Home); remove this line to restore the old one
import App from './App';
import { StoreProvider } from './store';
import { LanguageProvider } from './lib/i18n';
import { initVisits } from './lib/visits';

void initVisits(); // counts this visit (once per day) whatever page the person lands on

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </LanguageProvider>
  </StrictMode>,
);
