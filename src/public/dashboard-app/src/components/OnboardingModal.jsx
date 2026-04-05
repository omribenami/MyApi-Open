import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';

const POPULAR_SERVICES = [
  { id: 'github', name: 'GitHub', icon: '🐙', color: 'bg-gray-800 border-gray-600' },
  { id: 'google', name: 'Google', icon: '🔵', color: 'bg-blue-900 border-blue-600' },
  { id: 'slack', name: 'Slack', icon: '💬', color: 'bg-purple-900 border-purple-600' },
  { id: 'notion', name: 'Notion', icon: '📝', color: 'bg-gray-800 border-gray-500' },
  { id: 'discord', name: 'Discord', icon: '🎮', color: 'bg-indigo-900 border-indigo-600' },
  { id: 'linear', name: 'Linear', icon: '📐', color: 'bg-violet-900 border-violet-600' },
];

const DISMISSED_KEY = 'myapi_onboarding_dismissed';

export default function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [masterToken, setMasterToken] = useState(null);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [identity, setIdentity] = useState({
    name: user?.displayName || '',
    role: '',
    bio: '',
  });

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignored */ }
    onClose();
  };

  const handleStep1Submit = async () => {
    if (!identity.name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/onboard/step1', {
        name: identity.name.trim(),
        role: identity.role.trim(),
        bio: identity.bio.trim(),
      });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectService = (serviceId) => {
    const currentUrl = encodeURIComponent('/dashboard/');
    window.location.href = `/api/v1/oauth/connect/${serviceId}?next=${currentUrl}&mode=connect`;
  };

  const handleSkipStep2 = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post('/onboard/step3', {});
      setMasterToken(res.data?.masterToken || res.data?.data?.masterToken || null);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Setup error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    handleDismiss();
    navigate('/');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {step === 1 ? '👤' : step === 2 ? '🔗' : '🎉'}
            </span>
            <div>
              <h2 className="text-white font-semibold text-base">
                {step === 1 ? 'Set up your identity' : step === 2 ? 'Connect your first service' : "You're all set!"}
              </h2>
              <p className="text-slate-400 text-xs">Step {step} of 3</p>
            </div>
          </div>
          {/* Step dots */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full transition-colors ${
                  s === step ? 'bg-blue-500' : s < step ? 'bg-blue-800' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Identity */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">Tell us a bit about yourself so your AI agents know who they're helping.</p>
              <div>
                <label className="block text-slate-300 text-sm mb-1">Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={identity.name}
                  onChange={(e) => setIdentity({ ...identity, name: e.target.value })}
                  placeholder="Your full name"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm mb-1">Role</label>
                <input
                  type="text"
                  value={identity.role}
                  onChange={(e) => setIdentity({ ...identity, role: e.target.value })}
                  placeholder="e.g. Software Engineer, Product Manager"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm mb-1">Bio</label>
                <textarea
                  value={identity.bio}
                  onChange={(e) => setIdentity({ ...identity, bio: e.target.value })}
                  placeholder="A short description of what you do and how you work"
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Connect a service */}
          {step === 2 && (
            <div>
              <p className="text-slate-400 text-sm mb-4">Connect a service so your AI agents can take actions on your behalf. You can add more later.</p>
              <div className="grid grid-cols-3 gap-3">
                {POPULAR_SERVICES.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => handleConnectService(svc.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${svc.color} hover:opacity-80 transition-opacity cursor-pointer`}
                  >
                    <span className="text-2xl">{svc.icon}</span>
                    <span className="text-slate-200 text-xs font-medium">{svc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Ready */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm">Your platform is ready. Here's your master API token — save it somewhere safe.</p>
              {masterToken && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Master Token</p>
                  <code className="text-green-400 text-xs break-all select-all">{masterToken}</code>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <a
                  href="/dashboard/api-docs"
                  onClick={handleFinish}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                >
                  📚 API Docs
                </a>
                <a
                  href="/dashboard/services"
                  onClick={handleFinish}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                >
                  🔗 Add more services
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <button
            onClick={handleDismiss}
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
          >
            Skip for now
          </button>
          <div className="flex gap-2">
            {step === 1 && (
              <button
                onClick={handleStep1Submit}
                disabled={loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? 'Saving…' : 'Continue →'}
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleSkipStep2}
                disabled={loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? 'Setting up…' : 'Continue →'}
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleFinish}
                className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Go to Dashboard →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

