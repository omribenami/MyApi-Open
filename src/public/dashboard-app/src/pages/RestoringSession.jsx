import { useState, useEffect } from 'react';

function rand() {
  return Math.random().toString(16).slice(2, 6);
}

export default function RestoringSession({ onSignOut }) {
  const [dots, setDots] = useState('…');
  const [sessId] = useState(() => `${rand()}·${rand()}·${rand()}`);

  // Animate ellipsis
  useEffect(() => {
    let count = 0;
    const id = setInterval(() => {
      count = (count + 1) % 4;
      setDots('.'.repeat(count) || '…');
    }, 380);
    return () => clearInterval(id);
  }, []);

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <>
      <style>{`
        @keyframes rsBeaconPulse {
          0%   { transform: scale(.7); opacity: .7; border-width: 1.5px; }
          80%  { opacity: 0; border-width: 1px; }
          100% { transform: scale(2.2); opacity: 0; border-width: 1px; }
        }
        @keyframes rsOrbitSpin { to { transform: rotate(360deg); } }
        @keyframes rsSpinDot   { to { transform: rotate(360deg); } }
        @keyframes rsSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes rsLivePulse {
          0%   { box-shadow: 0 0 0 0 rgba(63,185,80,0.6); }
          70%  { box-shadow: 0 0 0 6px rgba(63,185,80,0); }
          100% { box-shadow: 0 0 0 0 rgba(63,185,80,0); }
        }
        .rs-live-dot { animation: rsLivePulse 1.6s ease-out infinite; }
        .rs-ring { animation: rsBeaconPulse 2.4s ease-out infinite; }
        .rs-orbit { animation: rsOrbitSpin 7s linear infinite; }
        .rs-step-spinner { animation: rsSpinDot .9s linear infinite; }
        .rs-progress-fill { animation: rsSlide 1.6s ease-in-out infinite; }
        .rs-grid-bg {
          background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 1.5px);
          background-size: 22px 22px;
        }
        .rs-hero-glow {
          background:
            radial-gradient(900px 500px at 50% -50px, rgba(56,139,253,0.18), transparent 60%),
            radial-gradient(700px 400px at 90% 100px, rgba(188,140,255,0.10), transparent 60%);
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
                <defs><linearGradient id="rsLg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4A8CFF"/><stop offset="100%" stopColor="#6058FF"/></linearGradient></defs>
                <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#rsLg)"/>
                <path d="M36 14 L25 31 H34 L30 50 L44 29 H35 L36 14 Z" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
              <span>MyApi</span>
            </a>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                <span className="rs-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0, display: 'inline-block' }} />
                SECURE SESSION
              </span>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="rs-hero-glow" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="rs-grid-bg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

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

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                    RESUMING
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="rs-live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--green)' }}>LIVE</span>
                  </span>
                </div>

                {/* Beacon */}
                <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 24px', display: 'grid', placeItems: 'center' }}>
                  {/* Pulse rings */}
                  {[0, 0.8, 1.6].map((delay, i) => (
                    <span key={i} className="rs-ring" style={{
                      position: 'absolute', width: 84, height: 84, borderRadius: '50%',
                      border: '1px solid rgba(56,139,253,.5)',
                      opacity: 0,
                      animationDelay: `${delay}s`,
                    }} />
                  ))}

                  {/* Orbiting satellites */}
                  <div className="rs-orbit" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
                    <span style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)', boxShadow: '0 0 8px rgba(188,140,255,.7)', top: 6, left: '50%', transform: 'translateX(-50%)' }} />
                    <span style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px rgba(56,139,253,.7)', bottom: 6, left: '50%', transform: 'translateX(-50%)' }} />
                    <span style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px rgba(63,185,80,.6)', top: '50%', left: 6, transform: 'translateY(-50%)' }} />
                    <span style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', boxShadow: '0 0 8px rgba(210,153,34,.6)', top: '50%', right: 6, transform: 'translateY(-50%)' }} />
                  </div>

                  {/* Core */}
                  <div style={{
                    width: 64, height: 64, borderRadius: 16,
                    background: 'linear-gradient(135deg, #4A8CFF 0%, #6058FF 100%)',
                    border: '1px solid rgba(255,255,255,.12)',
                    display: 'grid', placeItems: 'center', position: 'relative', zIndex: 3,
                    boxShadow: '0 8px 30px -8px rgba(74,140,255,.6)',
                  }}>
                    <svg width="32" height="32" viewBox="0 0 64 64">
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
                  Restoring your session{dots}
                </h1>

                {/* Progress bar */}
                <div style={{ marginTop: 28, position: 'relative', height: 2, borderRadius: 1, background: 'var(--line-2)', overflow: 'hidden' }}>
                  <div className="rs-progress-fill" style={{
                    position: 'absolute', inset: 0, width: '40%',
                    background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
                  }} />
                </div>

                {/* Session ID + sign out */}
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-4)' }}>
                    session_id: <span style={{ color: 'var(--ink-3)' }}>{sessId}</span>
                  </span>
                  <button
                    onClick={handleSignOut}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 12, padding: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-2)'}
                  >
                    Sign out
                  </button>
                </div>
              </div>

              {/* Vault notice */}
              <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7"/>
                  <path d="M3 4v5h5"/>
                </svg>
                <span>Vault key never leaves your device unencrypted.</span>
              </div>

              {/* Help */}
              <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: 'var(--ink-4)' }}>
                Taking too long?{' '}
                <button
                  onClick={handleSignOut}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}
                >
                  Sign in again
                </button>
              </div>

            </div>
          </section>
        </main>
      </div>
    </>
  );
}
