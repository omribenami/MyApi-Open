import { useEffect, useState } from 'react';

/* Ambient orb that drifts slowly */
function DriftOrb({ cx, cy, r, delay, duration, color }) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      style={{
        animation: `orbDrift ${duration}s ease-in-out ${delay}s infinite alternate`,
        transformOrigin: `${cx}px ${cy}px`,
        willChange: 'transform, opacity',
      }}
    />
  );
}

export default function SessionExpiredOverlay({ onDismiss }) {
  const [_visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Staggered entrance — tiny delay lets the overlay mount cleanly
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleSignIn = () => {
    setLeaving(true);
    setTimeout(() => {
      if (onDismiss) onDismiss();
      window.location.replace('/');
    }, 420);
  };

  return (
    <>
      <style>{`
        @keyframes orbDrift {
          from { transform: translate(0, 0) scale(1); opacity: 0.18; }
          to   { transform: translate(18px, -14px) scale(1.08); opacity: 0.32; }
        }
        @keyframes seoFadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes seoScaleIn {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes seoPulseRing {
          0%   { transform: scale(1);    opacity: 0.5; }
          70%  { transform: scale(1.55); opacity: 0; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes seoIconFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-5px); }
        }
        @keyframes seoOverlayIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to   { opacity: 1; backdrop-filter: blur(12px); }
        }
        @keyframes seoOverlayOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .seo-overlay {
          animation: seoOverlayIn 0.5s ease forwards;
        }
        .seo-overlay.leaving {
          animation: seoOverlayOut 0.4s ease forwards;
        }
        .seo-card {
          animation: seoScaleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
        }
        .seo-card.leaving {
          animation: seoScaleIn 0.35s cubic-bezier(0.7, 0, 1, 0.3) reverse forwards;
        }

        .seo-line-1 { animation: seoFadeUp 0.5s ease 0.20s both; }
        .seo-line-2 { animation: seoFadeUp 0.5s ease 0.33s both; }
        .seo-line-3 { animation: seoFadeUp 0.5s ease 0.42s both; }
        .seo-cta    { animation: seoFadeUp 0.5s ease 0.54s both; }
        .seo-footer { animation: seoFadeUp 0.5s ease 0.64s both; }

        .seo-icon-wrap {
          animation: seoIconFloat 3.8s ease-in-out 0.6s infinite;
        }
        .seo-pulse-ring {
          animation: seoPulseRing 2.4s ease-out 1.1s infinite;
        }

        .seo-btn {
          position: relative;
          overflow: hidden;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .seo-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%);
          background-size: 200% 100%;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .seo-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(99,102,241,0.45);
        }
        .seo-btn:hover::after {
          opacity: 1;
          animation: shimmer 0.75s ease forwards;
        }
        .seo-btn:active {
          transform: translateY(0px);
        }

        .seo-divider-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(148,163,184,0.15), transparent);
        }
      `}</style>

      {/* ── Backdrop ── */}
      <div
        className={`seo-overlay${leaving ? ' leaving' : ''}`}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(2, 6, 23, 0.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
      >
        {/* ── Ambient SVG background orbs ── */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
          aria-hidden="true"
        >
          <defs>
            <filter id="seoBlur1">
              <feGaussianBlur stdDeviation="60" />
            </filter>
            <filter id="seoBlur2">
              <feGaussianBlur stdDeviation="80" />
            </filter>
          </defs>
          <g filter="url(#seoBlur1)">
            <DriftOrb cx="20%" cy="30%" r="180" delay={0}   duration={7} color="rgba(79,70,229,0.55)" />
            <DriftOrb cx="78%" cy="65%" r="220" delay={1.4} duration={9} color="rgba(37,99,235,0.45)" />
          </g>
          <g filter="url(#seoBlur2)">
            <DriftOrb cx="55%" cy="15%" r="130" delay={0.7} duration={11} color="rgba(99,102,241,0.3)" />
            <DriftOrb cx="12%" cy="80%" r="150" delay={2.2} duration={8}  color="rgba(59,130,246,0.25)" />
          </g>
        </svg>

        {/* ── Card ── */}
        <div
          className={`seo-card${leaving ? ' leaving' : ''}`}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '440px',
            background: 'linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.88) 100%)',
            border: '1px solid rgba(148,163,184,0.10)',
            borderRadius: '20px',
            padding: '2.75rem 2.5rem 2.25rem',
            boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 32px 80px rgba(0,0,0,0.7), 0 0 60px rgba(79,70,229,0.08) inset',
            textAlign: 'center',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Subtle top edge highlight */}
          <div style={{
            position: 'absolute',
            top: 0, left: '10%', right: '10%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(148,163,184,0.22), transparent)',
            borderRadius: '100%',
          }} />

          {/* ── Icon area ── */}
          <div style={{ position: 'relative', display: 'inline-flex', marginBottom: '1.75rem' }}>
            {/* Pulse ring */}
            <div
              className="seo-pulse-ring"
              style={{
                position: 'absolute',
                inset: '-10px',
                borderRadius: '50%',
                border: '1px solid rgba(99,102,241,0.45)',
              }}
            />
            {/* Icon container */}
            <div
              className="seo-icon-wrap"
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(79,70,229,0.18) 0%, rgba(37,99,235,0.12) 100%)',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(79,70,229,0.2)',
              }}
            >
              {/* Moon + stars SVG */}
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Moon */}
                <path
                  d="M19 9C16.5 9 14.5 10 13 11.5C11 13.5 10.5 16 11 18.5C11.5 21 13 23 15 24C13 24.5 10.5 24 8.5 22.5C5.5 20 4.5 16 6 13C7.5 10 11 8 14.5 8C16 8 17.5 8.5 19 9Z"
                  fill="url(#moonGrad)"
                  opacity="0.9"
                />
                {/* Stars */}
                <circle cx="22" cy="7"  r="1.1" fill="rgba(148,163,184,0.7)" />
                <circle cx="25" cy="13" r="0.7" fill="rgba(148,163,184,0.5)" />
                <circle cx="20" cy="16" r="0.6" fill="rgba(148,163,184,0.45)" />
                <circle cx="24" cy="19" r="0.85" fill="rgba(148,163,184,0.55)" />
                <defs>
                  <linearGradient id="moonGrad" x1="6" y1="8" x2="19" y2="24" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#818cf8" />
                    <stop offset="1" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* ── Headline ── */}
          <h2
            className="seo-line-1"
            style={{
              fontSize: '1.625rem',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
              marginBottom: '0.875rem',
              background: 'linear-gradient(135deg, #e2e8f0 20%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            We missed you
          </h2>

          {/* ── Body copy ── */}
          <p
            className="seo-line-2"
            style={{
              fontSize: '0.9375rem',
              lineHeight: 1.65,
              color: 'rgba(148,163,184,0.85)',
              marginBottom: '0.5rem',
            }}
          >
            You were away long enough that we had to carry on without you — quietly signing you out to keep things secure.
          </p>
          <p
            className="seo-line-3"
            style={{
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: 'rgba(100,116,139,0.9)',
              marginBottom: '2rem',
            }}
          >
            Your data is safe and right where you left it.
          </p>

          {/* ── CTA ── */}
          <div className="seo-cta">
            <button
              onClick={handleSignIn}
              className="seo-btn"
              style={{
                width: '100%',
                padding: '0.8125rem 1.5rem',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                color: '#fff',
                fontSize: '0.9375rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              Sign back in
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginTop: '1px' }}>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* ── Footer note ── */}
          <div
            className="seo-footer"
            style={{
              marginTop: '1.625rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div className="seo-divider-line" />
            <span style={{
              fontSize: '0.75rem',
              color: 'rgba(100,116,139,0.65)',
              whiteSpace: 'nowrap',
              letterSpacing: '0.01em',
            }}>
              Signed out after 20 min of inactivity
            </span>
            <div className="seo-divider-line" />
          </div>
        </div>
      </div>
    </>
  );
}
