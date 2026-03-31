const LOGOUT_FLAG = '__myapi_logout_in_progress__';
const REDIRECT_TS_KEY = '__myapi_last_auth_redirect_ts__';
const REDIRECT_COOLDOWN_MS = 8000;

const now = () => Date.now();

export const isLogoutInProgress = () => {
  try {
    return sessionStorage.getItem(LOGOUT_FLAG) === '1';
  } catch {
    return Boolean(window.__myapiLogoutInProgress);
  }
};

export const setLogoutInProgress = (value) => {
  try {
    if (value) {
      sessionStorage.setItem(LOGOUT_FLAG, '1');
    } else {
      sessionStorage.removeItem(LOGOUT_FLAG);
    }
  } catch {
    // ignore storage failures
  }
  window.__myapiLogoutInProgress = Boolean(value);
};

export const clearAuthArtifacts = () => {
  try {
    localStorage.removeItem('masterToken');
    localStorage.removeItem('tokenData');
    localStorage.removeItem('profileAvatarUrl');
    sessionStorage.removeItem('sessionToken');
    sessionStorage.removeItem('tokenData');
  } catch {
    // ignore storage failures
  }
};

export const notifyAuthExpired = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('myapi:auth-expired'));
};

export const redirectToLoginOnce = () => {
  if (typeof window === 'undefined' || isLogoutInProgress()) return;

  try {
    const lastTs = Number(sessionStorage.getItem(REDIRECT_TS_KEY) || 0);
    const elapsed = now() - lastTs;
    if (Number.isFinite(lastTs) && elapsed < REDIRECT_COOLDOWN_MS) {
      return;
    }
    sessionStorage.setItem(REDIRECT_TS_KEY, String(now()));
  } catch {
    // ignore; still attempt soft redirect
  }

  notifyAuthExpired();

  // Don't redirect away from the OAuth authorize page — it renders its own
  // sign-in UI and must preserve the ChatGPT/OAuth params in the URL.
  if (window.location.pathname === '/dashboard/authorize') return;

  const onDashboard = window.location.pathname.startsWith('/dashboard');
  if (onDashboard) {
    window.history.replaceState({}, document.title, '/');
  }
}
