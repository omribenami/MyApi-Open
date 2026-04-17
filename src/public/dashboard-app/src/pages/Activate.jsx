import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import apiClient from '../utils/apiClient';

function CodeInput({ value, onChange }) {
  // XXXX-XXXX with auto-hyphen
  const handle = (e) => {
    let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4, 8);
    onChange(v);
  };
  return (
    <input
      type="text"
      maxLength={9}
      value={value}
      onChange={handle}
      placeholder="XXXX-XXXX"
      className="w-full text-center text-2xl font-mono tracking-widest bg-slate-800 border border-slate-600 rounded-xl px-5 py-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      autoFocus
    />
  );
}

function PendingCodeCard({ code, onApprove, onDeny, loading }) {
  const [selectedScope, setSelectedScope] = useState('full');
  const [label, setLabel] = useState('');
  const expiresAt = new Date(code.expires_at);
  const minutesLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 60000));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-200">{code.client_id}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Requested {new Date(code.created_at).toLocaleTimeString()} · expires in {minutesLeft}m
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
          Pending
        </span>
      </div>

      <div className="bg-slate-800/60 rounded-lg px-4 py-2.5">
        <p className="text-xs text-slate-500 mb-1">Optionally give this agent a name</p>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder={`${code.client_id} agent`}
          autoComplete="off"
          className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 focus:outline-none"
        />
      </div>

      <div className="bg-slate-800/60 rounded-lg px-4 py-2.5">
        <p className="text-xs text-slate-500 mb-1.5">Access level</p>
        <div className="flex gap-2">
          {[
            { value: 'full', label: 'Full access', desc: 'Same as master token' },
            { value: 'read', label: 'Read only', desc: 'No writes or admin' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedScope(opt.value)}
              className={`flex-1 rounded-lg px-3 py-2 text-left border transition-colors ${
                selectedScope === opt.value
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
              }`}
            >
              <p className="text-xs font-semibold">{opt.label}</p>
              <p className="text-xs opacity-60 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onApprove(code.id, label, selectedScope)}
          disabled={loading}
          className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => onDeny(code.id)}
          disabled={loading}
          className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-sm font-semibold transition-colors"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

export default function Activate() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }
  const [fetchingPending, setFetchingPending] = useState(true);

  // Pre-fill from ?code= query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preCode = params.get('code');
    if (preCode) setCode(preCode.toUpperCase());
  }, []);

  // Load pending codes
  const loadPending = () => {
    if (!isAuthenticated) return;
    setFetchingPending(true);
    apiClient.get('/agentic/device/pending')
      .then(r => setPending(r.data.codes || []))
      .catch(() => {})
      .finally(() => setFetchingPending(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPending(); }, [isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clean = code.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (clean.length !== 8) {
      setStatus({ type: 'error', message: 'Enter the full 8-character code (format: XXXX-XXXX).' });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      // Find the matching pending code
      const allCodes = (await apiClient.get('/agentic/device/pending')).data.codes || [];
      const match = allCodes.find(c => c.user_code.replace('-', '') === clean);
      if (!match) {
        setStatus({ type: 'error', message: 'Code not found or already expired. Ask the AI to start a new request.' });
        setLoading(false);
        return;
      }
      setPending(allCodes);
      setStatus({ type: 'info', message: 'Code found — approve or deny it below.' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to look up code. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id, label, scope) => {
    setLoading(true);
    try {
      await apiClient.post(`/agentic/device/approve/${id}`, { label, scope });
      setStatus({ type: 'success', message: 'Approved! The AI agent now has access and will receive its token automatically.' });
      loadPending();
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.error || 'Failed to approve.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async (id) => {
    setLoading(true);
    try {
      await apiClient.post(`/agentic/device/deny/${id}`);
      setStatus({ type: 'success', message: 'Request denied.' });
      loadPending();
    } catch {
      setStatus({ type: 'error', message: 'Failed to deny request.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-400 text-sm">
        <p>Sign in to approve AI agent access requests.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-8 py-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Activate AI Agent</h1>
        <p className="mt-1 text-slate-400 text-sm">
          Enter the code shown by your AI agent to grant it access to your MyApi account.
        </p>
      </div>

      {/* Code entry */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <p className="text-sm font-medium text-slate-300">Enter the code shown by your AI agent</p>
        <CodeInput value={code} onChange={setCode} />
        <button
          type="submit"
          disabled={loading || code.replace('-', '').length < 8}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
        >
          {loading ? 'Looking up…' : 'Find Request'}
        </button>
      </form>

      {/* Status message */}
      {status && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
          status.type === 'error'   ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                      'bg-blue-500/10 text-blue-400 border border-blue-500/20'
        }`}>
          {status.message}
        </div>
      )}

      {/* Pending requests */}
      {!fetchingPending && pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Pending Requests ({pending.length})
          </p>
          {pending.map(c => (
            <PendingCodeCard
              key={c.id}
              code={c}
              onApprove={handleApprove}
              onDeny={handleDeny}
              loading={loading}
            />
          ))}
        </div>
      )}

      {!fetchingPending && pending.length === 0 && (
        <div className="text-center py-4 text-slate-600 text-sm">
          No pending requests. When an AI starts a connection, it will appear here.
        </div>
      )}
    </div>
  );
}
