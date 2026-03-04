import { useEffect, useState } from 'react';

const COOKIE_NOTICE_KEY = 'cookie_notice_dismissed_v2';
const COOKIE_PREF_KEY = 'cookie_pref_v1'; // all | essential

const nanoBananaArt = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220" viewBox="0 0 520 220">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ecfeff"/>
      <stop offset="100%" stop-color="#dbeafe"/>
    </linearGradient>
    <linearGradient id="banana" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="520" height="220" rx="20" fill="url(#bg)"/>

  <!-- Nano bot -->
  <circle cx="130" cy="104" r="50" fill="#60a5fa"/>
  <rect x="166" y="78" width="90" height="52" rx="18" fill="#3b82f6"/>
  <circle cx="118" cy="95" r="6" fill="#0f172a"/>
  <circle cx="142" cy="95" r="6" fill="#0f172a"/>
  <path d="M118 116 Q130 126 142 116" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round"/>
  <rect x="104" y="138" width="52" height="14" rx="7" fill="#93c5fd"/>

  <!-- Banana cookie -->
  <path d="M320 132 C 364 168, 434 156, 460 112 C 436 118, 402 118, 370 94 C 338 70, 314 88, 306 106 C 298 122, 300 126, 320 132 Z" fill="url(#banana)" stroke="#92400e" stroke-width="4"/>
  <circle cx="354" cy="118" r="4" fill="#78350f"/>
  <circle cx="380" cy="124" r="4" fill="#78350f"/>
  <circle cx="406" cy="116" r="4" fill="#78350f"/>
  <circle cx="390" cy="104" r="4" fill="#78350f"/>

  <!-- Bite -->
  <circle cx="334" cy="126" r="10" fill="#ecfeff"/>
  <circle cx="346" cy="132" r="9" fill="#ecfeff"/>

  <text x="24" y="36" font-family="Arial" font-size="20" fill="#0f172a" font-weight="700">Nano Banana Cookie Mode 🍌</text>
  <text x="24" y="60" font-family="Arial" font-size="14" fill="#334155">Essential cookies keep login and OAuth alive. Optional cookies can be disabled.</text>
</svg>
`)}`;

export default function CookieNotice() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(COOKIE_NOTICE_KEY) === '1';
    setHidden(dismissed);
  }, []);

  const saveChoice = (mode) => {
    localStorage.setItem(COOKIE_PREF_KEY, mode);
    localStorage.setItem(COOKIE_NOTICE_KEY, '1');
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[92vw] max-w-md rounded-xl border border-blue-200 bg-sky-50 p-3 text-slate-800 shadow-xl">
      <img src={nanoBananaArt} alt="Nano banana AI with cookie" className="mb-2 h-28 w-full rounded-lg object-cover" />
      <p className="text-sm leading-relaxed">
        We use <strong>essential cookies</strong> for login/session and OAuth callbacks. Optional cookies can stay off.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
          onClick={() => saveChoice('all')}
        >
          Accept all
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
