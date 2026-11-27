import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { requestPersistentStorage, setSwRegistration } from './lib/pwa';
import App from './App.tsx';
import './index.css';

requestPersistentStorage().catch(() => {});

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, reg) {
    setSwRegistration(reg);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
