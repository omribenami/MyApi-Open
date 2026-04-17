import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';

import { dismissModal } from '../utils/onboardingUtils';

// ─── Service icons ────────────────────────────────────────────────────────────

const ServiceIcons = {
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
  slack: (
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zm2.521-10.123a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A" />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.012.043.031.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  ),
  notion: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.047.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  ),
  linear: (
    <svg viewBox="0 0 100 100" width="22" height="22" fill="#5E6AD2">
      <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L37.99 95.9282c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.0511 5.94895 79.9485 1.22541 61.5228zM.00189135 46.8891c-.01764375.2833.08887365.5599.28957165.7606L52.3503 99.7085c.2007.2007.4773.3075.7606.2896 2.3584-.1424 4.6394-.44 6.9249-.8954.3478-.0686.5973-.3978.5973-.7522v-.3018c0-.2901-.1197-.5671-.3282-.7675L3.08085 39.974c-.20043-.2004-.47745-.3202-.76748-.3282-.35426-.0015-.68345.2490-.75219.5973-.45579 2.2855-.75319 4.5250-.8954 6.9249zM4.57914 32.4548c-.14781.3542.04141.7584.38756.8817L66.7636 95.0423c.3461.1233.5275.5275.3876.8817-4.6564-1.9411-8.9813-4.7091-12.7585-8.4863-.2547-.2547-.2499-.6672.0115-.9161l.0115.0115L6.9698 35.447c-.2489-.2614-.6614-.2662-.9161-.0115-3.7772 3.7772-6.5452 8.1021-8.4863 12.7586z" />
    </svg>
  ),
};

const CONNECT_SERVICES = [
  { id: 'github',  name: 'GitHub'  },
  { id: 'google',  name: 'Google'  },
  { id: 'slack',   name: 'Slack'   },
  { id: 'discord', name: 'Discord' },
  { id: 'notion',  name: 'Notion'  },
  { id: 'linear',  name: 'Linear'  },
];

// ─── Per-step tips sourced from platform docs ─────────────────────────────────

const TIPS = [
  {
    label: 'Already have a USER.md?',
    body: "If your AI agent already knows you from a USER.md file, skip this — connect it first, then ask it to fill your profile for you automatically.",
  },
  {
    label: 'What gets saved here',
    body: "Your context is written into USER.md (who you are). Your tone and traits shape your first AI persona (how agents respond). Both can be refined anytime from the Identity page.",
  },
  {
    label: 'Why 2FA matters here',
    body: 'Your master token grants full read/write access to every connected service. 2FA ensures only you can log in and issue new tokens — even if your password is compromised.',
  },
  {
    label: 'Your credentials never leave MyApi',
    body: 'Connecting a service means MyApi proxies every request on your behalf. Agents receive scoped access tokens and call through the proxy — your actual OAuth secrets stay encrypted inside MyApi, never transmitted.',
  },
  {
    label: 'The pattern that works',
    body: 'Create a persona for a specific role, attach relevant knowledge docs to it, then issue it a scoped token with only the permissions it needs. Revoke the token any time without affecting anything else.',
  },
  {
    label: 'Your agent reads, you decide',
    body: 'Paste this prompt into any AI — Claude, ChatGPT, Gemini. It fetches the connection guide from your API and walks you through choosing and setting up a method. Nothing is sent until you approve.',
  },
];

// ─── Destination tiles for the Ready step ────────────────────────────────────

const NEXT_STEPS = [
  {
    path: '/personas',
    title: 'Create a Persona',
    desc: 'Give an agent a role, personality, and attached knowledge',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    path: '/knowledge',
    title: 'Add Knowledge',
    desc: 'Upload docs, SOPs, or notes that ground your agents',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    path: '/access-tokens',
    title: 'Issue a Token',
    desc: 'Create a scoped key for any agent or integration',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  {
    path: '/services',
    title: 'Connect Services',
    desc: 'Link GitHub, Google, Slack and 40+ more integrations',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingModal({ onClose }) {
  const [step, setStep]           = useState(1);
  const [visible, setVisible]     = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // Profile data collected across steps 1–2
  const [name, setName]             = useState(user?.displayName || '');
  const [role, setRole]             = useState('');
  const [bio, setBio]               = useState('');
  const [commStyle, setCommStyle]   = useState('direct');
  const [traits, setTraits]         = useState([]);
  const [customInstr, setCustomInstr] = useState('');

  // Step 3 — 2FA state
  const [twoFaQr, setTwoFaQr]         = useState(null);
  const [twoFaCode, setTwoFaCode]     = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaError, setTwoFaError]   = useState(null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Load QR code when user reaches 2FA step
  useEffect(() => {
    if (step !== 3 || twoFaQr || twoFaEnabled) return;
    setTwoFaLoading(true);
    setTwoFaError(null);
    apiClient.post('/auth/2fa/setup')
      .then(res => setTwoFaQr(res.data?.data?.qrCodeDataUrl || null))
      .catch(() => setTwoFaError('Could not load QR — you can enable 2FA later in Settings.'))
      .finally(() => setTwoFaLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleDismiss = () => {
    dismissModal();
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const goTo = (next) => {
    setTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setError(null);
      setTransitioning(false);
    }, 200);
  };

  // Step 1 → 2: validate locally, no API yet
  const handleStep1 = () => {
    if (!name.trim()) { setError('Display name is required'); return; }
    goTo(2);
  };

  // Step 2 → 3: save profile (name + role + bio) and create initial persona
  const handleStep2 = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/onboard/step1', {
        name: name.trim(),
        role: role.trim(),
        bio:  bio.trim(),
      });

      // Build and save initial persona from AI preferences
      const styleMap = {
        direct:   'Direct and concise. Give short, actionable answers. Skip preamble.',
        detailed: 'Detailed and thorough. Explain reasoning and use examples.',
        casual:   'Casual and collaborative. Conversational tone, think out loud.',
      };
      const traitLine = traits.length ? traits.join(', ') + '.' : null;
      const soulLines = [
        `You are a personal AI assistant for ${name.trim() || 'the user'}.`,
        '',
        '## Communication Style',
        styleMap[commStyle] || styleMap.direct,
      ];
      if (traitLine) soulLines.push('', '## Personality', traitLine);
      if (customInstr.trim()) soulLines.push('', '## Additional Instructions', customInstr.trim());
      const soulContent = soulLines.join('\n');

      await apiClient.post('/personas', {
        name: 'My Assistant',
        soul_content: soulContent,
        description: 'Initial persona created during onboarding',
      });

      goTo(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile — try again');
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — verify 2FA code
  const handleTwoFaVerify = async () => {
    if (twoFaCode.length !== 6) return;
    setTwoFaLoading(true);
    setTwoFaError(null);
    try {
      await apiClient.post('/auth/2fa/verify', { code: twoFaCode });
      setTwoFaEnabled(true);
      setTimeout(() => goTo(4), 1000);
    } catch (err) {
      setTwoFaError(err.response?.data?.error || 'Invalid code — check your app and try the current code');
    } finally {
      setTwoFaLoading(false);
    }
  };

  // Step 4 → 5: finalize onboarding
  const handleStep4 = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/onboard/step3', {});
      goTo(5);
    } catch (err) {
      setError(err.response?.data?.error || 'Setup error — try again');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectService = (serviceId) => {
    const next = encodeURIComponent('/dashboard/');
    window.location.href = `/api/v1/oauth/authorize/${serviceId}?mode=connect&next=${next}&redirect=1`;
  };

  const handleFinish = (path) => {
    handleDismiss();
    if (path) setTimeout(() => navigate(path), 320);
  };

  const [copied, setCopied] = useState(false);
  const tip = TIPS[step - 1];
  const TOTAL = 6;

  return (
    <>
      {/* Google Font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');`}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
        style={{
          background: 'rgba(2,6,23,0.75)',
          backdropFilter: 'blur(6px)',
          transition: 'opacity 0.28s ease',
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Modal */}
        <div
          className="relative w-full overflow-hidden flex flex-col"
          style={{
            maxWidth: 520,
            maxHeight: 'calc(100dvh - 2rem)',
            background: 'linear-gradient(165deg, rgb(15,23,42) 0%, rgb(15,20,40) 100%)',
            border: '1px solid rgba(100,116,139,0.25)',
            borderRadius: 20,
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
            fontFamily: "'Outfit', sans-serif",
            transition: 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.34,1.28,0.64,1)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
          }}
        >
          {/* Top accent line */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6) 30%, rgba(59,130,246,0.8) 50%, rgba(99,102,241,0.6) 70%, transparent)',
          }} />

          {/* ── Header ── */}
          <div className="px-6 pt-5 pb-0 flex-shrink-0">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                   style={{ color: 'rgba(147,197,253,0.7)', letterSpacing: '0.12em' }}>
                  Getting started — {step} of {TOTAL}
                </p>
                <h2 className="text-xl font-semibold text-white leading-tight">
                  {step === 1 && 'Your profile'}
                  {step === 2 && 'Your context'}
                  {step === 3 && 'Secure your account'}
                  {step === 4 && 'Connect a service'}
                  {step === 5 && 'You\'re all set'}
                  {step === 6 && 'Connect your AI agent'}
                </h2>
              </div>
              <button
                onClick={handleDismiss}
                className="flex items-center justify-center rounded-lg transition-colors mt-0.5"
                style={{
                  width: 32, height: 32,
                  background: 'rgba(148,163,184,0.08)',
                  border: '1px solid rgba(148,163,184,0.1)',
                  color: 'rgba(148,163,184,0.6)',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.background = 'rgba(148,163,184,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.6)'; e.currentTarget.style.background = 'rgba(148,163,184,0.08)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Progress segments */}
            <div className="flex gap-1.5 pb-5">
              {Array.from({ length: TOTAL }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  style={{
                    flex: 1, height: 3, borderRadius: 999,
                    transition: 'background 0.4s ease, opacity 0.4s ease',
                    background: s <= step
                      ? 'linear-gradient(90deg, #3b82f6, #6366f1)'
                      : 'rgba(51,65,85,0.8)',
                    opacity: s === step ? 1 : s < step ? 0.7 : 0.35,
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── Scrollable body (step content + tip) ── */}
          <div className="overflow-y-auto min-h-0 flex-1">

          {/* ── Step content ── */}
          <div
            className="px-6"
            style={{
              transition: 'opacity 0.2s ease, transform 0.2s ease',
              opacity: transitioning ? 0 : 1,
              transform: transitioning ? 'translateY(6px)' : 'translateY(0)',
            }}
          >
            {/* Error */}
            {error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-xl text-sm"
                   style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                {error}
              </div>
            )}

            {/* Step 1 — Profile */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.9)' }}>
                  Tell your agents who they're working with. This shapes every response they give you.
                </p>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                         style={{ color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em' }}>
                    Display Name <span style={{ color: '#60a5fa' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                    placeholder="How should agents address you?"
                    autoFocus
                    style={inputStyle}
                    onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                    onBlur={e => Object.assign(e.currentTarget.style, inputBlurStyle)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                         style={{ color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em' }}>
                    Role <span style={{ color: 'rgba(100,116,139,0.6)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStep1()}
                    placeholder="e.g. Software Engineer, Founder, Product Designer"
                    style={inputStyle}
                    onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                    onBlur={e => Object.assign(e.currentTarget.style, inputBlurStyle)}
                  />
                </div>
              </div>
            )}

            {/* Step 2 — Context + AI preferences */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.9)' }}>
                  A few sentences about yourself — your tools, how you work, what you're building.
                </p>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder={"e.g. Full-stack dev building a SaaS in TypeScript. I work best async and ship fast."}
                  style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
                  onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.currentTarget.style, inputBlurStyle)}
                />

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(51,65,85,0.6)', margin: '4px 0' }} />

                {/* Communication style */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                     style={{ color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em' }}>
                    How should agents respond?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { value: 'direct',   label: 'Direct & concise',      desc: 'Short answers, no fluff' },
                      { value: 'detailed', label: 'Detailed & thorough',   desc: 'Explain reasoning, examples' },
                      { value: 'casual',   label: 'Casual & collaborative',desc: 'Conversational, think out loud' },
                    ].map((opt) => {
                      const sel = commStyle === opt.value;
                      return (
                        <label
                          key={opt.value}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                            padding: '8px 12px', borderRadius: 10,
                            background: sel ? 'rgba(59,130,246,0.1)' : 'rgba(30,41,59,0.5)',
                            border: `1px solid ${sel ? 'rgba(59,130,246,0.45)' : 'rgba(51,65,85,0.7)'}`,
                            transition: 'background 0.15s, border-color 0.15s',
                          }}
                        >
                          <input
                            type="radio"
                            name="commStyle"
                            value={opt.value}
                            checked={sel}
                            onChange={() => setCommStyle(opt.value)}
                            style={{ marginTop: 2, accentColor: '#3b82f6', flexShrink: 0 }}
                          />
                          <span>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>{opt.label}</span>
                            <span style={{ display: 'block', fontSize: 11, color: 'rgba(100,116,139,0.9)' }}>{opt.desc}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Work traits */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                     style={{ color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em' }}>
                    Work traits <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'rgba(100,116,139,0.7)' }}>— pick up to 3</span>
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['Decisive', 'Analytical', 'Creative', 'Pragmatic', 'Detail-oriented', 'Big-picture'].map((t) => {
                      const sel = traits.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            if (sel) setTraits(traits.filter((x) => x !== t));
                            else if (traits.length < 3) setTraits([...traits, t]);
                          }}
                          style={{
                            padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                            background: sel ? 'rgba(59,130,246,0.15)' : 'rgba(30,41,59,0.6)',
                            border: `1px solid ${sel ? 'rgba(59,130,246,0.5)' : 'rgba(51,65,85,0.7)'}`,
                            color: sel ? '#93c5fd' : 'rgba(148,163,184,0.85)',
                          }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom instructions */}
                <textarea
                  value={customInstr}
                  onChange={(e) => setCustomInstr(e.target.value)}
                  rows={2}
                  placeholder="Custom instructions (optional) — e.g. Always ask before making assumptions."
                  style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, fontSize: 12 }}
                  onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.currentTarget.style, inputBlurStyle)}
                />
              </div>
            )}

            {/* Step 3 — 2FA setup */}
            {step === 3 && (
              <div className="space-y-4">
                {twoFaEnabled ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <p style={{ color: '#4ade80', fontWeight: 600, fontSize: 15 }}>2FA enabled</p>
                    <p style={{ color: 'rgba(148,163,184,0.75)', fontSize: 13, marginTop: 4 }}>Your account is now protected. Moving on…</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.9)' }}>
                      Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit code to activate.
                    </p>
                    {twoFaLoading && !twoFaQr && (
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ display: 'inline-block', width: 28, height: 28, borderRadius: '50%', borderBottom: '2px solid #3b82f6', animation: 'spin 0.8s linear infinite' }} />
                      </div>
                    )}
                    {twoFaQr && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-block', padding: 10, background: '#ffffff', borderRadius: 12 }}>
                          <img src={twoFaQr} alt="Scan with your authenticator app" style={{ width: 156, height: 156, display: 'block' }} />
                        </div>
                      </div>
                    )}
                    {twoFaError && !twoFaQr && (
                      <p style={{ fontSize: 12, color: '#fca5a5', textAlign: 'center' }}>{twoFaError}</p>
                    )}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'rgba(148,163,184,0.6)', letterSpacing: '0.08em' }}>
                        6-digit code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={twoFaCode}
                        onChange={(e) => { setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setTwoFaError(null); }}
                        onKeyDown={(e) => e.key === 'Enter' && twoFaCode.length === 6 && !twoFaLoading && handleTwoFaVerify()}
                        placeholder="000000"
                        style={{ ...inputStyle, letterSpacing: '0.35em', textAlign: 'center', fontSize: 22, fontWeight: 600 }}
                        onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                        onBlur={e => Object.assign(e.currentTarget.style, inputBlurStyle)}
                      />
                    </div>
                    {twoFaError && twoFaQr && (
                      <p style={{ fontSize: 12, color: '#fca5a5', marginTop: -8 }}>{twoFaError}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 4 — Connect a service */}
            {step === 4 && (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.9)' }}>
                  Connect a service to give your agents something to act on. You can add all 45+ integrations later from the Services page.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {CONNECT_SERVICES.map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => handleConnectService(svc.id)}
                      style={serviceBtnStyle}
                      onMouseEnter={e => Object.assign(e.currentTarget.style, serviceBtnHoverStyle)}
                      onMouseLeave={e => Object.assign(e.currentTarget.style, serviceBtnStyle)}
                    >
                      <span className="flex items-center justify-center" style={{ opacity: 0.9 }}>
                        {ServiceIcons[svc.id]}
                      </span>
                      <span className="text-xs font-medium" style={{ color: 'rgba(203,213,225,0.9)' }}>{svc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5 — Ready */}
            {step === 5 && (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.9)' }}>
                  Your workspace is configured and ready. Here's where to go next — or continue to connect your AI agent.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {NEXT_STEPS.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleFinish(item.path)}
                      className="text-left"
                      style={nextStepBtnStyle}
                      onMouseEnter={e => Object.assign(e.currentTarget.style, nextStepBtnHoverStyle)}
                      onMouseLeave={e => Object.assign(e.currentTarget.style, nextStepBtnStyle)}
                    >
                      <span style={{ color: 'rgba(96,165,250,0.85)' }} className="mb-2 block">{item.icon}</span>
                      <p className="text-sm font-semibold text-white mb-0.5">{item.title}</p>
                      <p className="text-xs leading-snug" style={{ color: 'rgba(100,116,139,0.9)' }}>{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6 — Connect Your AI Agent */}
            {step === 6 && (() => {
              const AGENT_PROMPT = `I'd like you to connect to my personal AI context API — MyApi.

Start by reading the connection guide (no auth needed):
  curl -s https://www.myapiai.com/api/v1/agent-guide

Once you've read it:
1. Summarize what MyApi can do and how it will improve our conversations
2. Walk me through each of the three connection methods with their pros and cons
3. Ask me a few questions to understand my situation, then recommend the best method
4. Guide me through the setup step by step — I'll follow your lead`;

              const CONNECTION_METHODS = [
                {
                  id: 'device_flow',
                  badge: 'Recommended',
                  badgeColor: 'rgba(59,130,246,0.15)',
                  badgeBorder: 'rgba(59,130,246,0.4)',
                  badgeText: 'rgba(147,197,253,0.95)',
                  title: 'OAuth Device Flow',
                  desc: 'Your agent requests a short code, you approve it in the browser — it gets its own named, scoped token.',
                  pros: ['Each agent gets its own token & audit trail', 'You explicitly approve every agent', 'Revoke a single agent without affecting others'],
                  cons: ['Requires opening a browser tab once to approve'],
                  bestFor: 'Most users',
                },
                {
                  id: 'master_token',
                  badge: 'Simplest',
                  badgeColor: 'rgba(234,179,8,0.1)',
                  badgeBorder: 'rgba(234,179,8,0.35)',
                  badgeText: 'rgba(253,224,71,0.9)',
                  title: 'Master Token',
                  desc: 'Copy your master token from Access Tokens and paste it directly into the agent.',
                  pros: ['Zero setup — token already exists', 'Works immediately with any HTTP client'],
                  cons: ['One token shared by all agents', 'Cannot be scoped to read-only'],
                  bestFor: 'Quick local experiments',
                },
                {
                  id: 'asc_keypair',
                  badge: 'Advanced',
                  badgeColor: 'rgba(168,85,247,0.1)',
                  badgeBorder: 'rgba(168,85,247,0.35)',
                  badgeText: 'rgba(216,180,254,0.9)',
                  title: 'ASC — Ed25519 Keypair',
                  desc: 'The agent generates a cryptographic keypair and signs every request. The private key never leaves the agent.',
                  pros: ['Strongest security — private key never transmitted', 'Cryptographic proof of origin per request', 'Replay protection built-in'],
                  cons: ['Agent must implement Ed25519 signing', 'Requires accurate system clock'],
                  bestFor: 'Production agents & automated pipelines',
                },
              ];

              return (
                <div className="space-y-3">
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(148,163,184,0.9)' }}>
                    There are three ways to connect an AI agent to your API. Pick the one that fits your situation.
                  </p>

                  {/* Connection method cards */}
                  <div className="space-y-2">
                    {CONNECTION_METHODS.map((m) => (
                      <div key={m.id} style={{
                        background: 'rgba(15,23,42,0.6)',
                        border: '1px solid rgba(51,65,85,0.7)',
                        borderRadius: 10,
                        padding: '11px 13px',
                      }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold" style={{ color: 'rgba(226,232,240,0.95)' }}>{m.title}</span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 20,
                            background: m.badgeColor,
                            border: `1px solid ${m.badgeBorder}`,
                            color: m.badgeText,
                            letterSpacing: '0.03em',
                          }}>{m.badge}</span>
                        </div>
                        <p className="text-xs mb-2" style={{ color: 'rgba(148,163,184,0.8)', lineHeight: 1.5 }}>{m.desc}</p>
                        <div className="flex gap-4">
                          <div style={{ flex: 1 }}>
                            {m.pros.map((p, i) => (
                              <div key={i} className="flex items-start gap-1.5 mb-0.5">
                                <span style={{ color: '#4ade80', fontSize: 10, marginTop: 2, flexShrink: 0 }}>✓</span>
                                <span className="text-xs" style={{ color: 'rgba(134,239,172,0.8)', lineHeight: 1.4 }}>{p}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ flex: 1 }}>
                            {m.cons.map((c, i) => (
                              <div key={i} className="flex items-start gap-1.5 mb-0.5">
                                <span style={{ color: '#f87171', fontSize: 10, marginTop: 2, flexShrink: 0 }}>✕</span>
                                <span className="text-xs" style={{ color: 'rgba(252,165,165,0.75)', lineHeight: 1.4 }}>{c}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs mt-1.5" style={{ color: 'rgba(100,116,139,0.9)' }}>
                          Best for: <span style={{ color: 'rgba(148,163,184,0.85)' }}>{m.bestFor}</span>
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* AI prompt section */}
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: 'rgba(100,116,139,0.9)' }}>
                      Or let your AI agent walk you through it — paste this prompt:
                    </p>
                    <div style={{
                      position: 'relative',
                      background: 'rgba(15,23,42,0.8)',
                      border: '1px solid rgba(71,85,105,0.5)',
                      borderRadius: 10,
                      padding: '12px 12px 38px 12px',
                    }}>
                      <pre style={{
                        margin: 0,
                        fontSize: 11,
                        lineHeight: 1.6,
                        color: 'rgba(203,213,225,0.85)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                      }}>{AGENT_PROMPT}</pre>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(AGENT_PROMPT).then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          });
                        }}
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: copied ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(71,85,105,0.6)',
                          background: copied ? 'rgba(34,197,94,0.08)' : 'rgba(30,41,59,0.8)',
                          color: copied ? 'rgba(134,239,172,0.9)' : 'rgba(148,163,184,0.9)',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {copied ? '✓ Copied' : 'Copy Prompt'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Tip block ── */}
          <div
            className="mx-6 mt-4 mb-1"
            style={{
              borderRadius: 12,
              background: 'rgba(59,130,246,0.05)',
              border: '1px solid rgba(59,130,246,0.15)',
              borderLeft: '3px solid rgba(59,130,246,0.5)',
              padding: '10px 14px',
              transition: 'opacity 0.2s ease',
              opacity: transitioning ? 0 : 1,
            }}
          >
            <div className="flex gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: 'rgba(147,197,253,0.9)' }}>{tip.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.75)' }}>{tip.body}</p>
              </div>
            </div>
          </div>
          </div>{/* end scrollable body */}

          {/* ── Footer ── */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(51,65,85,0.6)', marginTop: 0 }}
          >
            <button
              onClick={handleDismiss}
              className="text-xs transition-colors"
              style={{ color: 'rgba(100,116,139,0.8)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(148,163,184,0.9)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(100,116,139,0.8)'; }}
            >
              {step === 3 ? 'Skip for now' : 'Skip setup'}
            </button>

            <div className="flex items-center gap-2">
              {/* Back button (steps 2–4, but not while 2FA is auto-advancing) */}
              {step > 1 && step < 5 && !twoFaEnabled && (
                <button
                  onClick={() => goTo(step - 1)}
                  disabled={loading || twoFaLoading}
                  className="px-4 py-2 text-sm font-medium rounded-xl transition-colors"
                  style={{
                    background: 'rgba(51,65,85,0.5)',
                    border: '1px solid rgba(71,85,105,0.5)',
                    color: 'rgba(148,163,184,0.9)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(71,85,105,0.6)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(51,65,85,0.5)'; }}
                >
                  Back
                </button>
              )}

              {/* Primary action */}
              {step === 1 && (
                <button
                  onClick={handleStep1}
                  disabled={!name.trim()}
                  style={primaryBtnStyle(!name.trim())}
                  onMouseEnter={e => { if (name.trim()) e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  Continue
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handleStep2}
                  disabled={loading}
                  style={primaryBtnStyle(loading)}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {loading ? 'Saving…' : bio.trim() ? 'Continue' : 'Skip'}
                </button>
              )}
              {step === 3 && !twoFaEnabled && (
                <>
                  <button
                    onClick={() => goTo(4)}
                    className="px-4 py-2 text-sm font-medium rounded-xl transition-colors"
                    style={{
                      background: 'rgba(51,65,85,0.5)',
                      border: '1px solid rgba(71,85,105,0.5)',
                      color: 'rgba(148,163,184,0.9)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(71,85,105,0.6)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(51,65,85,0.5)'; }}
                  >
                    Maybe Later
                  </button>
                  <button
                    onClick={handleTwoFaVerify}
                    disabled={twoFaCode.length !== 6 || twoFaLoading || !twoFaQr}
                    style={primaryBtnStyle(twoFaCode.length !== 6 || twoFaLoading || !twoFaQr)}
                    onMouseEnter={e => { if (twoFaCode.length === 6 && !twoFaLoading && twoFaQr) e.currentTarget.style.opacity = '0.88'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    {twoFaLoading ? 'Verifying…' : 'Enable 2FA'}
                  </button>
                </>
              )}
              {step === 4 && (
                <button
                  onClick={handleStep4}
                  disabled={loading}
                  style={primaryBtnStyle(loading)}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {loading ? 'Setting up…' : 'Continue'}
                </button>
              )}
              {step === 5 && (
                <button
                  onClick={() => setStep(6)}
                  style={primaryBtnStyle(false)}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  Next →
                </button>
              )}
              {step === 6 && (
                <button
                  onClick={() => handleFinish('/')}
                  style={primaryBtnStyle(false)}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Style helpers (inline styles for fine-grained control) ──────────────────

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(30,41,59,0.7)',
  border: '1px solid rgba(71,85,105,0.5)',
  borderRadius: 12,
  color: '#f1f5f9',
  fontSize: 14,
  fontFamily: "'Outfit', sans-serif",
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const inputFocusStyle = {
  borderColor: 'rgba(99,102,241,0.6)',
  boxShadow: '0 0 0 3px rgba(99,102,241,0.12)',
};

const inputBlurStyle = {
  borderColor: 'rgba(71,85,105,0.5)',
  boxShadow: 'none',
};

const serviceBtnStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '14px 8px',
  background: 'rgba(30,41,59,0.5)',
  border: '1px solid rgba(51,65,85,0.7)',
  borderRadius: 12,
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
};

const serviceBtnHoverStyle = {
  ...serviceBtnStyle,
  background: 'rgba(51,65,85,0.6)',
  borderColor: 'rgba(99,102,241,0.3)',
};

const nextStepBtnStyle = {
  padding: '14px',
  background: 'rgba(30,41,59,0.5)',
  border: '1px solid rgba(51,65,85,0.7)',
  borderRadius: 12,
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
  textAlign: 'left',
};

const nextStepBtnHoverStyle = {
  ...nextStepBtnStyle,
  background: 'rgba(51,65,85,0.6)',
  borderColor: 'rgba(59,130,246,0.25)',
};

const primaryBtnStyle = (disabled) => ({
  padding: '9px 20px',
  background: disabled
    ? 'rgba(37,99,235,0.35)'
    : 'linear-gradient(135deg, #3b82f6, #6366f1)',
  border: 'none',
  borderRadius: 10,
  color: disabled ? 'rgba(255,255,255,0.4)' : '#fff',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "'Outfit', sans-serif",
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'opacity 0.15s',
  letterSpacing: '0.01em',
});
