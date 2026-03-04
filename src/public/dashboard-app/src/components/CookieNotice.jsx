import { useEffect, useState } from 'react';

const COOKIE_NOTICE_KEY = 'cookie_notice_dismissed_v3';
const COOKIE_PREF_KEY = 'cookie_pref_v1'; // all | essential

export default function CookieNotice() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(COOKIE_NOTICE_KEY) === '1';
    setHidden(dismissed);

    // hydrate from backend preference if available
    fetch('/api/v1/privacy/cookies', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const mode = data?.data?.mode;
        if (mode === 'all' || mode === 'essential') {
          localStorage.setItem(COOKIE_PREF_KEY, mode);
        }
      })
      .catch(() => {});
  }, []);

  const saveChoice = async (mode) => {
    const normalized = mode === 'all' ? 'all' : 'essential';
    localStorage.setItem(COOKIE_PREF_KEY, normalized);
    localStorage.setItem(COOKIE_NOTICE_KEY, '1');
    setHidden(true);

    try {
      await fetch('/api/v1/privacy/cookies', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: normalized }),
      });
    } catch {
      // keep local preference if backend unavailable
    }
  };

  if (hidden) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[92vw] max-w-md rounded-xl border border-blue-200 bg-sky-50 p-3 text-slate-800 shadow-xl">
      <img src="cookie-nano.jpg" alt="Nano banana AI with cookie" className="mb-2 h-28 w-full rounded-lg object-cover" />
      <p className="text-sm leading-relaxed">
        Choose your cookie mode. <strong>Essential cookies</strong> keep login/session and OAuth working.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
          onClick={() => saveChoice('all')}
        >
          Full cookies
        </button>
        <button
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          onClick={() => saveChoice('essential')}
        >
          Essential only
        </button>
        <button
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
          onClick={() => saveChoice('essential')}
        >
          Reject optional
        </button>
      </div>
    </div>
  );
}
