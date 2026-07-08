import { useState, useEffect } from 'react';

const PROVIDERS = {
  google: {
    label: 'Google',
    handshakeWord: 'google',
    nodeBg: '#fff',
    nodeBorder: '1px solid #e0e0e0',
    accent: '#4493f8',
    accentRgb: '56,139,253',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  github: {
    label: 'GitHub',
    handshakeWord: 'github',
    nodeBg: '#0d1117',
    nodeBorder: '1px solid var(--line)',
    accent: '#bc8cff',
    accentRgb: '188,140,255',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#f0f6fc">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
  facebook: {
    label: 'Facebook',
    handshakeWord: 'facebook',
    nodeBg: '#1877F2',
    nodeBorder: '1px solid rgba(255,255,255,.08)',
    accent: '#3b82f6',
    accentRgb: '59,130,246',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
};

function getProvider(serviceKey) {
  const key = (serviceKey || '').toLowerCase();
  return PROVIDERS[key] || PROVIDERS.google;
}

function rand() {
  return Math.random().toString(16).slice(2, 6);
}

export default function SigningIn({ serviceKey, onCancel }) {
  const provider = getProvider(serviceKey);

  const [dots, setDots] = useState('…');
  const [reqId] = useState(() => `${rand()}·${rand()}·${rand()}`);

  // Animate ellipsis
  useEffect(() => {
    let count = 0;
    const id = setInterval(() => {
      count = (count + 1) % 4;
      setDots('.'.repeat(count) || '…');
    }, 380);
    return () => clearInterval(id);
  }, []);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      window.location.href = '/';
    }
  };

  const accentRgb = provider.accentRgb;
  const accent = provider.accent;

  return (
    <>
      <style>{`
        @keyframes signingFlowWire {
          0%   { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes signingPulseRing {
          0%   { transform: scale(.85); opacity: .9; }
          100% { transform: scale(1.25); opacity: 0; }
        }
        @keyframes signingSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes signingSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes signingLivePulse {
          0%   { box-shadow: 0 0 0 0 rgba(63,185,80,0.6); }
          70%  { box-shadow: 0 0 0 6px rgba(63,185,80,0); }
          100% { box-shadow: 0 0 0 0 rgba(63,185,80,0); }
        }
        .signing-wire-fill {
          background: linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%);
          background-size: 200% 100%;
          animation: signingFlowWire 1.6s linear infinite;
        }
        .signing-pulse-ring {
          animation: signingPulseRing 2s ease-out infinite;
        }
        .signing-step-spinner {
          animation: signingSpin .9s linear infinite;
        }
        .signing-progress-fill {
          animation: signingSlide 1.6s ease-in-out infinite;
        }
        .signing-live-dot {
          animation: signingLivePulse 1.6s ease-out infinite;
        }
        .signing-grid-bg {
          background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 1.5px);
          background-size: 22px 22px;
        }
        .signing-hero-glow {
          background:
            radial-gradient(900px 500px at 50% -50px, rgba(${accentRgb}, 0.22), transparent 60%),
            radial-gradient(700px 400px at 90% 100px, rgba(${accentRgb}, 0.10), transparent 60%);
        }
        @media (max-width: 520px) {
          .signing-wire { flex-basis: 36px !important; }
          .signing-node { width: 48px !important; height: 48px !important; border-radius: 12px !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', fontFamily: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif" }}>

        {/* Nav */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 30,
          borderBottom: '1px solid var(--line)',
          background: 'rgba(13,17,23,0.85)',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
              <svg width="26" height="26" viewBox="0 0 64 64">
                <defs><linearGradient id="siLg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4A8CFF"/><stop offset="100%" stopColor="#6058FF"/></linearGradient></defs>
                <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#siLg)"/>
                <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
              <span>MyApi</span>
            </a>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                <span className="signing-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0, display: 'inline-block' }} />
                SECURE SESSION
              </span>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="signing-hero-glow" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="signing-grid-bg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

          <section style={{
            position: 'relative',
            maxWidth: 1200, margin: '0 auto', padding: '56px 24px',
            minHeight: 'calc(100vh - 56px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '100%', maxWidth: 440 }}>

              {/* Auth card */}
              <div style={{
                background: 'linear-gradient(180deg, var(--bg-raised), var(--bg))',
                border: '1px solid var(--line)',
                borderRadius: 14,
                boxShadow: '0 24px 80px -20px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.02) inset',
                padding: '28px 36px',
              }}>

                {/* Header row: provider badge + LIVE */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 9px 3px 7px', borderRadius: 999,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: accent,
                    background: `rgba(${accentRgb}, 0.18)`,
                    border: `1px solid rgba(${accentRgb}, 0.35)`,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                    via {provider.label}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="signing-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green)' }}>LIVE</span>
                  </span>
                </div>

                {/* Provider ↔ MyApi chain */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 32 }}>
                  {/* Provider node */}
                  <div className="signing-node" style={{
                    width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: 14,
                    background: provider.nodeBg,
                    border: provider.nodeBorder,
                    flexShrink: 0,
                  }}>
                    {provider.icon}
                  </div>

                  {/* Animated wire */}
                  <div className="signing-wire" style={{ position: 'relative', flex: '0 0 64px', height: 2, borderRadius: 1, background: 'var(--line)', overflow: 'hidden' }}>
                    <div className="signing-wire-fill" style={{ position: 'absolute', inset: 0 }} />
                  </div>

                  {/* MyApi node */}
                  <div style={{
                    width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: 14,
                    background: 'linear-gradient(135deg, #4A8CFF 0%, #6058FF 100%)',
                    border: '1px solid rgba(255,255,255,.12)',
                    position: 'relative', flexShrink: 0,
                  }}>
                    <span className="signing-pulse-ring" style={{
                      position: 'absolute', inset: -6, borderRadius: 18,
                      border: `1px solid rgba(${accentRgb}, .55)`,
                      pointerEvents: 'none',
                    }} />
                    <svg width="28" height="28" viewBox="0 0 64 64">
                      <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>

                {/* Headline */}
                <h1 style={{
                  fontSize: 26, lineHeight: 1.15, letterSpacing: '-0.02em', fontWeight: 600, textAlign: 'center',
                  background: 'linear-gradient(180deg, #f0f6fc 0%, #a7b3c1 100%)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  margin: 0,
                }}>
                  Signing you in{dots}
                </h1>

                {/* Progress bar */}
                <div style={{ marginTop: 28, position: 'relative', height: 2, borderRadius: 1, background: 'var(--line-2)', overflow: 'hidden' }}>
                  <div className="signing-progress-fill" style={{
                    position: 'absolute', inset: 0, width: '40%',
                    background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                  }} />
                </div>

                {/* Request ID + cancel */}
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-4)' }}>
                    request_id: <span style={{ color: 'var(--ink-3)' }}>{reqId}</span>
                  </span>
                  <button
                    onClick={handleCancel}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 12, padding: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-2)'}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* TLS notice */}
              <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>End-to-end TLS. MyApi never sees your <span style={{ color: 'var(--ink-2)' }}>{provider.label}</span> password.</span>
              </div>

              {/* Stuck help */}
              <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: 'var(--ink-4)' }}>
                Stuck for more than 30 seconds?{' '}
                <button
                  onClick={handleCancel}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}
                >
                  Try again
                </button>
              </div>

            </div>
          </section>
        </main>
      </div>
    </>
  );
}
