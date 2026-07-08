import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class RootErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0b0f1a', color: '#e2e8f0', fontFamily: 'monospace', padding: '2rem' }}>
          <h1 style={{ color: '#f87171', marginBottom: '1rem' }}>Dashboard Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#1e2d40', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
            {this.state.error?.message || String(this.state.error)}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Emergency client-side guard for rare storage/db corruption errors surfaced by browser/runtime.
// v3: also clears IndexedDB databases (source of SQLite WAL corruption in Safari/WebKit).
// If detected, clear local auth/session artifacts once and reload cleanly.
if (typeof window !== 'undefined') {
  const CORRUPTION_MARKERS = [
    'Corruption: block checksum mismatch',
    'block checksum mismatch',
  ];
  const RECOVERY_TS_KEY = '__myapi_corruption_recovery_ts__';
  const RECOVERY_COUNT_KEY = '__myapi_corruption_recovery_count__';

  const doReload = () => {
    try { window.location.replace(window.location.href); } catch { /* continue degraded */ }
  };

  const clearIndexedDB = (onDone) => {
    try {
      if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
        indexedDB.databases().then((dbs) => {
          if (!dbs.length) { onDone(); return; }
          let remaining = dbs.length;
          dbs.forEach((info) => {
            const req = indexedDB.deleteDatabase(info.name);
            req.onsuccess = req.onerror = req.onblocked = () => { if (--remaining === 0) onDone(); };
          });
        }).catch(onDone);
      } else {
        onDone();
      }
    } catch { onDone(); }
  };

  const recoverFromCorruption = () => {
    // Hard runtime guard: if browser storage itself is corrupted/unavailable,
    // sessionStorage-based guards may fail and cause infinite reload loops.
    if (window.__myapiCorruptionRecovered) {
      console.warn('[MyApi] Corruption detected again; auto-reload disabled to prevent loop.');
      return;
    }
    window.__myapiCorruptionRecovered = true;

    try {
      const now = Date.now();
      const lastTs = Number(sessionStorage.getItem(RECOVERY_TS_KEY) || 0);
      const recoveries = Number(sessionStorage.getItem(RECOVERY_COUNT_KEY) || 0);

      // Allow up to 3 recoveries per 30 minutes — corruption can fire from multiple
      // IDB stores (Google Identity, accounts.google.com iframe) on a single boot,
      // and __myapiCorruptionRecovered already blocks same-page-load loops.
      if (Number.isFinite(lastTs) && now - lastTs < 30 * 60 * 1000 && recoveries >= 3) {
        console.warn('[MyApi] Corruption detected again; skipping auto-reload to avoid loop.');
        return;
      }

      sessionStorage.setItem(RECOVERY_TS_KEY, String(now));
      sessionStorage.setItem(RECOVERY_COUNT_KEY, String(recoveries + 1));

      // Clear ALL auth artifacts so OAuth login works cleanly after reload.
      // masterToken lives in sessionStorage; __myapi_logged_out__ flag in localStorage
      // would otherwise block initialize() from restoring the session.
      sessionStorage.removeItem('masterToken');
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('sessionAuthVerified');
      sessionStorage.removeItem('tokenData');
      localStorage.removeItem('masterToken');
      localStorage.removeItem('tokenData');
      localStorage.removeItem('__myapi_logged_out__');
    } catch {
      // Ignore cleanup errors and still try a one-time clean navigation.
    }

    // Clear any IndexedDB databases (SQLite WAL corruption in WebKit browsers lives here),
    // then reload once so the browser starts with a clean storage state.
    console.warn('[MyApi] Corruption recovery executed. Clearing IndexedDB and reloading.');
    clearIndexedDB(doReload);
  };

  const messageFromError = (value) => {
    if (typeof value === 'string') return value;
    return value?.message || String(value || '');
  };

  window.addEventListener('unhandledrejection', (event) => {
    const message = messageFromError(event?.reason);
    if (!CORRUPTION_MARKERS.some((marker) => message.includes(marker))) return;

    event.preventDefault();
    recoverFromCorruption();
  });

  // Some environments surface this as a regular error event instead of a rejected promise.
  window.addEventListener('error', (event) => {
    const message = messageFromError(event?.error || event?.message);
    if (!CORRUPTION_MARKERS.some((marker) => message.includes(marker))) return;

    event.preventDefault?.();
    recoverFromCorruption();
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
