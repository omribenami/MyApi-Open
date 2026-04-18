import { useState } from 'react';

function WaitlistForm({ defaultEmail = '', title, subtitle, onBack }) {
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Unable to join the waitlist right now');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Unable to join the waitlist right now');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <h3 className="text-lg font-semibold text-emerald-300 mb-2">You're on the list</h3>
        <p className="text-sm text-slate-300">
          Thanks! We'll email <span className="font-mono text-slate-100">{email}</span> as soon as a spot opens up.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          In the meantime, feel free to{' '}
          <a href="https://discord.gg/WPp4sCN4xB" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
            join our Discord
          </a>{' '}
          — early beta testers often hear about access there first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">{title || "We're at capacity right now"}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {subtitle || "MyApi is currently in closed beta and all seats are taken. Drop your email and we'll let you know the moment a spot opens."}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60"
        >
          {submitting ? 'Joining waitlist...' : 'Join the waitlist'}
        </button>
      </form>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          ← Back
        </button>
      )}
    </div>
  );
}

export default WaitlistForm;
