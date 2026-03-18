import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Emergency client-side guard for rare storage/db corruption errors surfaced by browser/runtime.
// If detected, clear local auth/session artifacts once and reload cleanly.
if (typeof window !== 'undefined') {
  const CORRUPTION_MARKER = 'Corruption: block checksum mismatch';
  const RECOVERY_KEY = '__myapi_recovered_from_corruption__';

  const recoverFromCorruption = () => {
    try {
      if (sessionStorage.getItem(RECOVERY_KEY)) return;
      sessionStorage.setItem(RECOVERY_KEY, '1');
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
