import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

async function apiRequest(url, options = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => '');
  if (!res.ok) {
    const err = new Error((typeof payload === 'object' ? payload?.error : payload) || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function StatusBadge({ status }) {
  const color = status === 'invited'
    ? 'bg-blue-900/40 text-blue-200 border-blue-700'
    : status === 'converted'
      ? 'bg-emerald-900/40 text-emerald-200 border-emerald-700'
      : 'bg-slate-800 text-slate-300 border-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium capitalize ${color}`}>
      {status || 'pending'}
    </span>
  );
}

function BetaAdmin() {
  const masterToken = useAuthStore((s) => s.masterToken);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const [skipNotified, setSkipNotified] = useState(true);

  const authOptions = () => {
    const options = { credentials: 'include' };
    if (masterToken) options.headers = { Authorization: `Bearer ${masterToken}` };
    return options;
  };

  const fetchWaitlist = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiRequest('/api/v1/waitlist?limit=500', authOptions());
      setEntries(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setLoadError(err.message || 'Failed to load waitlist');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, [masterToken]);

  const total = entries.length;
  const pending = entries.filter((e) => e.status !== 'converted').length;
  const notNotified = entries.filter((e) => !e.notified_at && e.status !== 'converted').length;
  const notifyTarget = skipNotified ? notNotified : pending;

  const notifyLaunch = async () => {
    setActionError('');
    setActionSuccess('');
    const label = skipNotified
      ? `Email the ${notNotified} waitlist entr${notNotified === 1 ? 'y' : 'ies'} that haven't been notified yet?`
      : `Email ALL ${pending} pending waitlist entr${pending === 1 ? 'y' : 'ies'} (including ones already notified)?`;
    if (!window.confirm(label)) return;

    setSending(true);
    try {
      const opts = {
        ...authOptions(),
        method: 'POST',
        headers: {
          ...(authOptions().headers || {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ skipNotified }),
      };
      const data = await apiRequest('/api/v1/waitlist/notify-launch', opts);
      const summary = data?.data || {};
      setActionSuccess(`Sent ${summary.sent || 0} / ${summary.totalCandidates || 0}. Failures: ${summary.failed || 0}.`);
      fetchWaitlist();
    } catch (err) {
      setActionError(err.message || 'Failed to send launch emails');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Beta Waitlist</h1>
          <p className="text-slate-400 mt-2">People who signed up to be notified when a spot opens.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm">
            <div className="text-slate-400 text-xs uppercase tracking-wide">Total</div>
            <div className="text-white font-semibold text-xl">{total}</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm">
            <div className="text-slate-400 text-xs uppercase tracking-wide">Pending</div>
            <div className="text-white font-semibold text-xl">{pending}</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm">
            <div className="text-slate-400 text-xs uppercase tracking-wide">Not notified</div>
            <div className="text-white font-semibold text-xl">{notNotified}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-3">
        <h2 className="text-lg font-semibold text-white">Announce launch</h2>
        <p className="text-sm text-slate-400">
          Send the "beta is over, come join" email to everyone on the waitlist. The email is branded, links back to the MyApi website, and invites them to sign up.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={skipNotified}
            onChange={(e) => setSkipNotified(e.target.checked)}
            className="accent-blue-600"
          />
          Only email people who haven't been notified yet
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={sending || notifyTarget === 0}
            onClick={notifyLaunch}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50 hover:from-blue-500 hover:to-indigo-500"
          >
            {sending
              ? 'Sending...'
              : `Notify ${notifyTarget} waitlist entr${notifyTarget === 1 ? 'y' : 'ies'}`}
          </button>
          {actionSuccess && <span className="text-sm text-emerald-300">{actionSuccess}</span>}
          {actionError && <span className="text-sm text-red-300">{actionError}</span>}
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 text-red-200 p-3 text-sm">{loadError}</div>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Entries ({total})</h2>
          <button
            type="button"
            onClick={fetchWaitlist}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-6 text-slate-400 text-sm">Loading waitlist…</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-slate-400 text-sm">No waitlist entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">Email</th>
                  <th className="text-left px-5 py-2 font-medium">Status</th>
                  <th className="text-left px-5 py-2 font-medium">Joined</th>
                  <th className="text-left px-5 py-2 font-medium">Notified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-2 text-white font-mono text-xs break-all">{entry.email}</td>
                    <td className="px-5 py-2"><StatusBadge status={entry.status} /></td>
                    <td className="px-5 py-2 text-slate-300">{formatDate(entry.created_at)}</td>
                    <td className="px-5 py-2 text-slate-300">{formatDate(entry.notified_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default BetaAdmin;
