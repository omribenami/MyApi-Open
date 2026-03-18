import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Emergency client-side guard for rare storage/db corruption errors surfaced by browser/runtime.
// If detected, clear local auth/session artifacts once and reload cleanly.
if (typeof window !== 'undefined') {
  const CORRUPTION_MARKER = 'Corruption: block checksum mismatch';
  const RECOVERY_TS_KEY = '__myapi_corruption_recovery_ts__';

  const recoverFromCorruption = () => {
    try {
      const now = Date.now();
      const lastTs = Number(sessionStorage.getItem(RECOVERY_TS_KEY) || 0);

      // Guard against tight redirect loops, but still allow repeated recovery attempts.
      if (Number.isFinite(lastTs) && now - lastTs < 1500) return;
      sessionStorage.setItem(RECOVERY_TS_KEY, String(now));

      localStorage.removeItem('masterToken');
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('tokenData');
    } catch {
      // Ignore cleanup errors and still force a clean reload.
    }

    window.location.replace('/dashboard/');
  };

  const messageFromError = (value) => {
    if (typeof value === 'string') return value;
    return value?.message || String(value || '');
  };

  window.addEventListener('unhandledrejection', (event) => {
    const message = messageFromError(event?.reason);
    if (!message.includes(CORRUPTION_MARKER)) return;

    event.preventDefault();
    recoverFromCorruption();
  });

  // Some environments surface this as a regular error event instead of a rejected promise.
  window.addEventListener('error', (event) => {
    const message = messageFromError(event?.error || event?.message);
    if (!message.includes(CORRUPTION_MARKER)) return;

    event.preventDefault?.();
    recoverFromCorruption();
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
