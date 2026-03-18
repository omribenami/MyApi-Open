import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Emergency client-side guard for rare storage/db corruption errors surfaced by browser/runtime.
// If detected, clear local auth/session artifacts once and reload cleanly.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message = typeof reason === 'string'
      ? reason
      : (reason?.message || String(reason || ''));

    if (message.includes('Corruption: block checksum mismatch')) {
      event.preventDefault();
      const key = '__myapi_recovered_from_corruption__';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        localStorage.removeItem('masterToken');
        sessionStorage.removeItem('sessionToken');
        sessionStorage.removeItem('tokenData');
        window.location.replace('/dashboard/');
      }
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
