import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';
import { dismissModal } from '../utils/onboardingUtils';

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

const TIPS = [
  { label: 'Already have a USER.md?', body: "If your AI agent already knows you from a USER.md file, skip this — connect it first, then ask it to fill your profile for you automatically." },
  { label: 'What gets saved here', body: "Your context is written into USER.md (who you are). Your tone and traits shape your first AI persona (how agents respond). Both can be refined anytime from the Identity page." },
  { label: 'Why 2FA matters here', body: 'Your master token grants full read/write access to every connected service. 2FA ensures only you can log in and issue new tokens — even if your password is compromised.' },
  { label: 'Your credentials never leave MyApi', body: 'Connecting a service means MyApi proxies every request on your behalf. Agents receive scoped access tokens and call through the proxy — your actual OAuth secrets stay encrypted inside MyApi, never transmitted.' },
  { label: 'The pattern that works', body: 'Create a persona for a specific role, attach relevant knowledge docs to it, then issue it a scoped token with only the permissions it needs. Revoke the token any time without affecting anything else.' },
  { label: 'Your agent reads, you decide', body: 'Paste this prompt into any AI — Claude, ChatGPT, Gemini. It fetches the connection guide from your API and walks you through choosing and setting up a method. Nothing is sent until you approve.' },
];

const NEXT_STEPS = [
  { path: '/personas', title: 'Create a Persona', desc: 'Give an agent a role, personality, and attached knowledge', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>) },
  { path: '/knowledge', title: 'Add Knowledge', desc: 'Upload docs, SOPs, or notes that ground your agents', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>) },
  { path: '/access-tokens', title: 'Issue a Token', desc: 'Create a scoped key for any agent or integration', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>) },
  { path: '/services', title: 'Connect Services', desc: 'Link GitHub, Google, Slack and 40+ more integrations', icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>) },
];

export default function OnboardingModal({ onClose }) {
  const [step, setStep]           = useState(1);
  const [visible, setVisible]     = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [name, setName]             = useState(user?.displayName || '');
  const [role, setRole]             = useState('');
  const [bio, setBio]               = useState('');
  const [commStyle, setCommStyle]   = useState('direct');
  const [traits, setTraits]         = useState([]);
  const [customInstr, setCustomInstr] = useState('');

  const [twoFaQr, setTwoFaQr]         = useState(null);
  const [twoFaCode, setTwoFaCode]     = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaError, setTwoFaError]   = useState(null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

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
    setTimeout(() => { setStep(next); setError(null); setTransitioning(false); }, 200);
  };

  const handleStep1 = () => {
    if (!name.trim()) { setError('Display name is required'); return; }
    goTo(2);
  };

  const handleStep2 = async () => {
    setLoading(true); setError(null);
    try {
      await apiClient.post('/onboard/step1', { name: name.trim(), role: role.trim(), bio: bio.trim() });
      const styleMap = { direct: 'Direct and concise. Give short, actionable answers. Skip preamble.', detailed: 'Detailed and thorough. Explain reasoning and use examples.', casual: 'Casual and collaborative. Conversational tone, think out loud.' };
      const traitLine = traits.length ? traits.join(', ') + '.' : null;
      const soulLines = [`You are a personal AI assistant for ${name.trim() || 'the user'}.`, '', '## Communication Style', styleMap[commStyle] || styleMap.direct];
      if (traitLine) soulLines.push('', '## Personality', traitLine);
      if (customInstr.trim()) soulLines.push('', '## Additional Instructions', customInstr.trim());
      await apiClient.post('/personas', { name: 'My Assistant', soul_content: soulLines.join('\n'), description: 'Initial persona created during onboarding' });
      goTo(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile — try again');
    } finally { setLoading(false); }
  };

  const handleTwoFaVerify = async () => {
    if (twoFaCode.length !== 6) return;
    setTwoFaLoading(true); setTwoFaError(null);
    try {
      await apiClient.post('/auth/2fa/verify', { code: twoFaCode });
      setTwoFaEnabled(true);
      setTimeout(() => goTo(4), 1000);
    } catch (err) {
      setTwoFaError(err.response?.data?.error || 'Invalid code — check your app and try the current code');
    } finally { setTwoFaLoading(false); }
  };

  const handleStep4 = async () => {
    setLoading(true); setError(null);
    try {
      await apiClient.post('/onboard/step3', {});
      goTo(5);
    } catch (err) {
      setError(err.response?.data?.error || 'Setup error — try again');
    } finally { setLoading(false); }
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(1,4,9,0.8)', backdropFilter: 'blur(4px)', transition: 'opacity 0.28s', opacity: visible ? 1 : 0 }}
    >
      <div
        className="relative w-full flex flex-col"
        style={{
          maxWidth: 520,
          maxHeight: 'calc(100dvh - 2rem)',
          background: 'var(--bg-raised)',
          border: '1px solid var(--line)',
          borderRadius: '8px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          transition: 'opacity 0.28s, transform 0.28s cubic-bezier(0.34,1.28,0.64,1)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.98)',
        }}
      >
        {/* Top accent line */}
        <div style={{ height: '2px', background: 'var(--accent)', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '18px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div className="micro" style={{ marginBottom: '4px', color: 'var(--ink-4)' }}>
                GETTING STARTED — {step} of {TOTAL}
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                {step === 1 && 'Your profile'}
                {step === 2 && 'Your context'}
                {step === 3 && 'Secure your account'}
                {step === 4 && 'Connect a service'}
                {step === 5 && "You're all set"}
                {step === 6 && 'Connect your AI agent'}
              </h2>
            </div>
            <button
              onClick={handleDismiss}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-hover)', border: '1px solid var(--line)', borderRadius: '5px', cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--ink)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Progress */}
          <div style={{ display: 'flex', gap: '4px', paddingBottom: '16px' }}>
            {Array.from({ length: TOTAL }, (_, i) => i + 1).map((s) => (
              <div key={s} style={{ flex: 1, height: '3px', borderRadius: '999px', background: s <= step ? 'var(--accent)' : 'var(--line)', opacity: s <= step ? 1 : 0.4, transition: 'background 0.3s, opacity 0.3s' }} />
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }} className="thin-scroll">
          {/* Step content */}
          <div style={{ padding: '0 20px', transition: 'opacity 0.2s, transform 0.2s', opacity: transitioning ? 0 : 1, transform: transitioning ? 'translateY(4px)' : 'translateY(0)' }}>

            {error && (
              <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '6px', background: 'var(--red-bg)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {/* Step 1 — Profile */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>
                  Tell your agents who they're working with. This shapes every response they give you.
                </p>
                <div>
                  <label style={labelStyle}>Display Name <span style={{ color: 'var(--accent)' }}>*</span></label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleStep1()} placeholder="How should agents address you?" autoFocus className="ui-input" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={labelStyle}>Role <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>— optional</span></label>
                  <input type="text" value={role} onChange={e => setRole(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleStep1()} placeholder="e.g. Software Engineer, Founder, Product Designer" className="ui-input" style={{ width: '100%' }} />
                </div>
              </div>
            )}

            {/* Step 2 — Context + preferences */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>
                  A few sentences about yourself — your tools, how you work, what you're building.
                </p>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="e.g. Full-stack dev building a SaaS in TypeScript. I work best async and ship fast." className="ui-input" style={{ width: '100%', resize: 'none', lineHeight: 1.6 }} />

                <div style={{ height: '1px', background: 'var(--line-2)' }} />

                <div>
                  <div style={labelStyle}>How should agents respond?</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { value: 'direct',   label: 'Direct & concise',       desc: 'Short answers, no fluff' },
                      { value: 'detailed', label: 'Detailed & thorough',    desc: 'Explain reasoning, examples' },
                      { value: 'casual',   label: 'Casual & collaborative', desc: 'Conversational, think out loud' },
                    ].map((opt) => {
                      const sel = commStyle === opt.value;
                      return (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '8px 12px', borderRadius: '6px', background: sel ? 'var(--accent-bg)' : 'var(--bg-sunk)', border: `1px solid ${sel ? 'var(--accent-2)' : 'var(--line)'}`, transition: 'background 0.15s, border-color 0.15s' }}>
                          <input type="radio" name="commStyle" value={opt.value} checked={sel} onChange={() => setCommStyle(opt.value)} style={{ marginTop: '3px', accentColor: 'var(--accent)', flexShrink: 0 }} />
                          <span>
                            <span style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{opt.label}</span>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-3)' }}>{opt.desc}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Work traits <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>— pick up to 3</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['Decisive', 'Analytical', 'Creative', 'Pragmatic', 'Detail-oriented', 'Big-picture'].map((t) => {
                      const sel = traits.includes(t);
                      return (
                        <button key={t} type="button" onClick={() => { if (sel) setTraits(traits.filter(x => x !== t)); else if (traits.length < 3) setTraits([...traits, t]); }}
                          style={{ padding: '3px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', background: sel ? 'var(--accent-bg)' : 'var(--bg-sunk)', border: `1px solid ${sel ? 'var(--accent-2)' : 'var(--line)'}`, color: sel ? 'var(--accent)' : 'var(--ink-3)', transition: 'all 0.15s' }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea value={customInstr} onChange={e => setCustomInstr(e.target.value)} rows={2} placeholder="Custom instructions (optional) — e.g. Always ask before making assumptions." className="ui-input" style={{ width: '100%', resize: 'none', lineHeight: 1.6, fontSize: '12px' }} />
              </div>
            )}

            {/* Step 3 — 2FA */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {twoFaEnabled ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--green-bg)', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <p style={{ color: 'var(--green)', fontWeight: 600, fontSize: '15px', margin: '0 0 4px' }}>2FA enabled</p>
                    <p style={{ color: 'var(--ink-3)', fontSize: '13px', margin: 0 }}>Your account is now protected. Moving on…</p>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>
                      Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit code to activate.
                    </p>
                    {twoFaLoading && !twoFaQr && (
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', borderBottom: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
                      </div>
                    )}
                    {twoFaQr && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-block', padding: '8px', background: '#fff', borderRadius: '6px' }}>
                          <img src={twoFaQr} alt="Scan with authenticator" style={{ width: 148, height: 148, display: 'block' }} />
                        </div>
                      </div>
                    )}
                    {twoFaError && !twoFaQr && (
                      <p style={{ fontSize: '12px', color: 'var(--red)', textAlign: 'center', margin: 0 }}>{twoFaError}</p>
                    )}
                    <div>
                      <label style={labelStyle}>6-digit code</label>
                      <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={twoFaCode}
                        onChange={e => { setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setTwoFaError(null); }}
                        onKeyDown={e => e.key === 'Enter' && twoFaCode.length === 6 && !twoFaLoading && handleTwoFaVerify()}
                        placeholder="000000" className="ui-input"
                        style={{ width: '100%', letterSpacing: '0.35em', textAlign: 'center', fontSize: '22px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }} />
                    </div>
                    {twoFaError && twoFaQr && <p style={{ fontSize: '12px', color: 'var(--red)', margin: 0 }}>{twoFaError}</p>}
                  </>
                )}
              </div>
            )}

            {/* Step 4 — Connect a service */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>
                  Connect a service to give your agents something to act on. You can add all 45+ integrations later from the Services page.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
                  {CONNECT_SERVICES.map((svc) => (
                    <button key={svc.id} onClick={() => handleConnectService(svc.id)}
                      className="btn"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', padding: '14px 8px' }}
                    >
                      <span style={{ opacity: 0.9, color: 'var(--ink-2)' }}>{ServiceIcons[svc.id]}</span>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink-2)' }}>{svc.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5 — Ready */}
            {step === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>
                  Your workspace is configured and ready. Here's where to go next — or continue to connect your AI agent.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                  {NEXT_STEPS.map((item) => (
                    <button key={item.path} onClick={() => handleFinish(item.path)} className="btn" style={{ textAlign: 'left', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: 'var(--accent)' }}>{item.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{item.title}</span>
                      <span style={{ fontSize: '11px', color: 'var(--ink-3)', lineHeight: 1.4 }}>{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6 — Connect AI Agent */}
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
                { id: 'device_flow', badge: 'Recommended', badgeColor: 'var(--accent-bg)', badgeBorder: 'var(--accent-2)', badgeText: 'var(--accent)', title: 'OAuth Device Flow', desc: 'Your agent requests a short code, you approve it in the browser — it gets its own named, scoped token.', pros: ['Each agent gets its own token & audit trail', 'You explicitly approve every agent', 'Revoke a single agent without affecting others'], cons: ['Requires opening a browser tab once to approve'], bestFor: 'Most users' },
                { id: 'master_token', badge: 'Simplest', badgeColor: 'rgba(210,153,34,0.12)', badgeBorder: 'var(--amber)', badgeText: 'var(--amber)', title: 'Master Token', desc: 'Copy your master token from Access Tokens and paste it directly into the agent.', pros: ['Zero setup — token already exists', 'Works immediately with any HTTP client'], cons: ['One token shared by all agents', 'Cannot be scoped to read-only'], bestFor: 'Quick local experiments' },
                { id: 'asc_keypair', badge: 'Advanced', badgeColor: 'rgba(188,140,255,0.1)', badgeBorder: 'rgba(188,140,255,0.5)', badgeText: '#bc8cff', title: 'ASC — Ed25519 Keypair', desc: 'The agent generates a cryptographic keypair and signs every request. The private key never leaves the agent.', pros: ['Strongest security — private key never transmitted', 'Cryptographic proof of origin per request', 'Replay protection built-in'], cons: ['Agent must implement Ed25519 signing', 'Requires accurate system clock'], bestFor: 'Production agents & automated pipelines' },
              ];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>
                    There are three ways to connect an AI agent to your API. Pick the one that fits your situation.
                  </p>
                  {CONNECTION_METHODS.map((m) => (
                    <div key={m.id} style={{ background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '6px', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{m.title}</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: m.badgeColor, border: `1px solid ${m.badgeBorder}`, color: m.badgeText }}>{m.badge}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.5 }}>{m.desc}</p>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                          {m.pros.map((p, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '2px' }}>
                              <span style={{ color: 'var(--green)', fontSize: '10px', marginTop: '2px', flexShrink: 0 }}>✓</span>
                              <span style={{ fontSize: '11px', color: 'var(--green)', lineHeight: 1.4, opacity: 0.85 }}>{p}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ flex: 1 }}>
                          {m.cons.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '2px' }}>
                              <span style={{ color: 'var(--red)', fontSize: '10px', marginTop: '2px', flexShrink: 0 }}>✕</span>
                              <span style={{ fontSize: '11px', color: 'var(--red)', lineHeight: 1.4, opacity: 0.8 }}>{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--ink-4)', marginTop: '6px', marginBottom: 0 }}>Best for: <span style={{ color: 'var(--ink-3)' }}>{m.bestFor}</span></p>
                    </div>
                  ))}

                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '6px' }}>Or let your AI agent walk you through it — paste this prompt:</p>
                    <div style={{ position: 'relative', background: 'var(--bg-sunk)', border: '1px solid var(--line)', borderRadius: '6px', padding: '12px 12px 40px 12px' }}>
                      <pre style={{ margin: 0, fontSize: '11px', lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'JetBrains Mono, monospace' }}>{AGENT_PROMPT}</pre>
                      <button onClick={() => { navigator.clipboard.writeText(AGENT_PROMPT).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
                        style={{ position: 'absolute', bottom: '8px', right: '8px', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${copied ? 'var(--green)' : 'var(--line)'}`, background: copied ? 'var(--green-bg)' : 'var(--bg-hover)', color: copied ? 'var(--green)' : 'var(--ink-3)', fontSize: '11px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                        {copied ? '✓ Copied' : 'Copy Prompt'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Tip block */}
          {tip && (
            <div style={{ margin: '14px 20px 4px', borderRadius: '6px', background: 'var(--accent-bg)', border: '1px solid var(--line)', borderLeft: '3px solid var(--accent)', padding: '10px 14px', transition: 'opacity 0.2s', opacity: transitioning ? 0 : 1 }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', margin: '0 0 2px' }}>{tip.label}</p>
                  <p style={{ fontSize: '12px', color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>{tip.body}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
          <button onClick={handleDismiss} style={{ fontSize: '12px', color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--ink-3)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-4)'}>
            {step === 3 ? 'Skip for now' : 'Skip setup'}
          </button>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {step > 1 && step < 5 && !twoFaEnabled && (
              <button onClick={() => goTo(step - 1)} disabled={loading || twoFaLoading} className="btn" style={{ minHeight: '32px', padding: '5px 14px', fontSize: '13px' }}>
                Back
              </button>
            )}

            {step === 1 && (
              <button onClick={handleStep1} disabled={!name.trim()} className="btn-primary" style={{ minHeight: '32px', padding: '5px 16px', fontSize: '13px', opacity: !name.trim() ? 0.5 : 1, cursor: !name.trim() ? 'not-allowed' : 'pointer' }}>
                Continue
              </button>
            )}
            {step === 2 && (
              <button onClick={handleStep2} disabled={loading} className="btn-primary" style={{ minHeight: '32px', padding: '5px 16px', fontSize: '13px', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Saving…' : bio.trim() ? 'Continue' : 'Skip'}
              </button>
            )}
            {step === 3 && !twoFaEnabled && (
              <>
                <button onClick={() => goTo(4)} className="btn" style={{ minHeight: '32px', padding: '5px 14px', fontSize: '13px' }}>
                  Maybe later
                </button>
                <button onClick={handleTwoFaVerify} disabled={twoFaCode.length !== 6 || twoFaLoading || !twoFaQr} className="btn-primary" style={{ minHeight: '32px', padding: '5px 16px', fontSize: '13px', opacity: (twoFaCode.length !== 6 || twoFaLoading || !twoFaQr) ? 0.5 : 1, cursor: (twoFaCode.length !== 6 || twoFaLoading || !twoFaQr) ? 'not-allowed' : 'pointer' }}>
                  {twoFaLoading ? 'Verifying…' : 'Enable 2FA'}
                </button>
              </>
            )}
            {step === 4 && (
              <button onClick={handleStep4} disabled={loading} className="btn-primary" style={{ minHeight: '32px', padding: '5px 16px', fontSize: '13px', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Setting up…' : 'Continue'}
              </button>
            )}
            {step === 5 && (
              <button onClick={() => setStep(6)} className="btn-primary" style={{ minHeight: '32px', padding: '5px 16px', fontSize: '13px' }}>
                Next →
              </button>
            )}
            {step === 6 && (
              <button onClick={() => handleFinish('/')} className="btn-primary" style={{ minHeight: '32px', padding: '5px 16px', fontSize: '13px' }}>
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--ink-3)',
  marginBottom: '6px',
  fontFamily: 'JetBrains Mono, monospace',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
};
