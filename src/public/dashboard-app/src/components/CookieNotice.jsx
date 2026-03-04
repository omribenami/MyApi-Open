import { useEffect, useState } from 'react';

const COOKIE_NOTICE_KEY = 'cookie_notice_dismissed_v1';

const aiCookieArt = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120" viewBox="0 0 220 120">
  <rect width="220" height="120" rx="18" fill="#E0F2FE"/>
  <circle cx="66" cy="60" r="28" fill="#93C5FD"/>
  <rect x="86" y="45" width="52" height="30" rx="12" fill="#60A5FA"/>
  <circle cx="58" cy="56" r="3" fill="#0F172A"/><circle cx="74" cy="56" r="3" fill="#0F172A"/>
  <path d="M58 68 Q66 74 74 68" stroke="#0F172A" stroke-width="2" fill="none"/>
  <circle cx="167" cy="65" r="22" fill="#FDE68A"/>
  <circle cx="158" cy="60" r="3" fill="#92400E"/><circle cx="172" cy="57" r="3" fill="#92400E"/><circle cx="173" cy="69" r="3" fill="#92400E"/>
  <path d="M134 62 Q146 58 152 64" stroke="#334155" stroke-width="4" fill="none" stroke-linecap="round"/>
  <text x="20" y="24" fill="#0F172A" font-size="13" font-family="Arial">AI + cookies = better sessions 🍪</text>
</svg>
`)}`;

export default function CookieNotice() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(COOKIE_NOTICE_KEY) === '1';
    setHidden(dismissed);
  }, []);

  if (hidden) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-blue-200 bg-sky-50 p-3 text-slate-800 shadow-lg">
      <img src={aiCookieArt} alt="AI eating cookies" className="mb-2 h-24 w-full rounded-lg object-cover" />
      <p className="text-sm">
        We use cookies to keep you logged in and make OAuth work smoothly.
      </p>
      <button
        className="mt-2 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
        onClick={() => {
          localStorage.setItem(COOKIE_NOTICE_KEY, '1');
          setHidden(true);
        }}
      >
        Got it
      </button>
    </div>
  );
}
