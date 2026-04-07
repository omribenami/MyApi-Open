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
// v2: inline onerror recovery added to index.html handles pre-load failures.
// If detected, clear local auth/session artifacts once and reload cleanly.
if (typeof window !== 'undefined') {
  const CORRUPTION_MARKERS = [
    'Corruption: block checksum mismatch',
    'block checksum mismatch',
    'IndexedDB',
  ];
  const RECOVERY_TS_KEY = '__myapi_corruption_recovery_ts__';
  const RECOVERY_COUNT_KEY = '__myapi_corruption_recovery_count__';

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

      // Prevent runaway reload storms that can trigger Cloudflare 1015 bans.
      // Allow only one auto-recovery every 30 minutes per tab.
      if (Number.isFinite(lastTs) && now - lastTs < 30 * 60 * 1000 && recoveries >= 1) {
        console.warn('[MyApi] Corruption detected again; skipping auto-reload to avoid loop.');
        return;
      }

      sessionStorage.setItem(RECOVERY_TS_KEY, String(now));
      sessionStorage.setItem(RECOVERY_COUNT_KEY, String(recoveries + 1));

      localStorage.removeItem('masterToken');
      sessionStorage.removeItem('sessionToken');
      sessionStorage.removeItem('tokenData');
    } catch {
      // Ignore cleanup errors and still try a one-time clean navigation.
    }

    // Perform a single clean reload so the browser can start with a fresh
    // storage/IndexedDB state. The sessionStorage guards above ensure this
    // reload only happens once every 30 minutes, preventing reload storms.
    console.warn('[MyApi] Corruption recovery executed. Reloading for clean state.');
    try {
      window.location.replace(window.location.href);
    } catch {
      // If navigation fails, the app will continue in a degraded but functional state.
    }
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
