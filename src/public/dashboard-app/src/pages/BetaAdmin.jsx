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
    throw err;
  }
  return payload;
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function StatusBadge({ status }) {
  const styles = {
    invited:   'border-[color:var(--accent)]   bg-[var(--accent-bg)]   text-[color:var(--accent)]',
    converted: 'border-[color:var(--green)]    bg-[var(--green-bg)]    text-[color:var(--green)]',
  };
  const cls = styles[status] || 'border-[color:var(--line)] bg-[var(--bg-raised)] text-[color:var(--ink-3)]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium capitalize ${cls}`}>
      {status || 'pending'}
    </span>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="ui-card px-4 py-3 min-w-[88px]">
      <div className="micro mb-1">{label}</div>
      <div className="ink font-semibold" style={{ fontSize: 22 }}>{value}</div>
    </div>
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

  useEffect(() => { fetchWaitlist(); }, [masterToken]);

  const total = entries.length;
  const pending = entries.filter((e) => e.status !== 'converted').length;
  const notNotified = entries.filter((e) => !e.notified_at && e.status !== 'converted').length;
  const notifyTarget = skipNotified ? notNotified : pending;

  const notifyLaunch = async () => {
    setActionError('');
    setActionSuccess('');
    const label = skipNotified
      ? `Email the ${notNotified} waitlist entr${notNotified === 1 ? 'y' : 'ies'} that haven't been notified yet?`
      : `Email ALL ${pending} pending waitlist entr${pending === 1 ? 'y' : 'ies'} (including already notified)?`;
    if (!window.confirm(label)) return;
    setSending(true);
    try {
      const opts = {
        ...authOptions(),
        method: 'POST',
        headers: { ...(authOptions().headers || {}), 'Content-Type': 'application/json' },
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
    <div className="ui-page">
      {/* Header */}
      <div className="ui-page-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="ui-title">Beta Waitlist</h1>
            <p className="ui-subtitle mt-1">People who signed up to be notified when a spot opens.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <StatCard label="TOTAL"        value={total} />
            <StatCard label="PENDING"      value={pending} />
            <StatCard label="NOT NOTIFIED" value={notNotified} />
          </div>
        </div>
      </div>

      {/* Announce section */}
      <div className="ui-card p-5 space-y-3">
        <h2 className="ink font-semibold" style={{ fontSize: 15 }}>Announce launch</h2>
        <p className="ui-subtitle leading-relaxed">
          Send the "beta is over, come join" email to everyone on the waitlist. The email is branded, links back to the MyApi website, and invites them to sign up.
        </p>
        <label className="flex items-center gap-2 text-[13px] ink-2 cursor-pointer">
          <input
            type="checkbox"
            checked={skipNotified}
            onChange={(e) => setSkipNotified(e.target.checked)}
            className="accent-[color:var(--accent)] w-4 h-4"
          />
          Only email people who haven't been notified yet
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            disabled={sending || notifyTarget === 0}
            onClick={notifyLaunch}
            className="ui-button-primary"
          >
            {sending ? 'Sending…' : `Notify ${notifyTarget} waitlist entr${notifyTarget === 1 ? 'y' : 'ies'}`}
          </button>
          {actionSuccess && <span className="text-[13px]" style={{ color: 'var(--green)' }}>{actionSuccess}</span>}
          {actionError   && <span className="text-[13px]" style={{ color: 'var(--red)' }}>{actionError}</span>}
        </div>
      </div>

      {loadError && (
        <div className="ui-card p-3 text-[13px]" style={{ borderColor: 'var(--red)', color: 'var(--red)', background: 'var(--red-bg)' }}>
          {loadError}
        </div>
      )}

      {/* Entries table */}
      <div className="ui-card overflow-hidden">
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="flex items-center justify-between">
            <span className="ink font-semibold text-[14px]">Entries ({total})</span>
            <button type="button" onClick={fetchWaitlist} className="ui-button text-[12px]">Refresh</button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 ui-subtitle text-[13px]">Loading waitlist…</div>
        ) : entries.length === 0 ? (
          <div className="p-6 ui-subtitle text-[13px]">No waitlist entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead style={{ background: 'var(--bg-sunk)', borderBottom: '1px solid var(--line)' }}>
                <tr>
                  {['Email', 'Status', 'Joined', 'Notified'].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 font-medium micro">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className="density-row"
                    style={{
                      borderBottom: i < entries.length - 1 ? '1px solid var(--line-2)' : 'none',
                      paddingTop: 10,
                      paddingBottom: 10,
                    }}
                  >
                    <td className="px-5 py-2.5 mono text-[12px]" style={{ color: 'var(--ink)' }}>{entry.email}</td>
                    <td className="px-5 py-2.5"><StatusBadge status={entry.status} /></td>
                    <td className="px-5 py-2.5 ink-2">{formatDate(entry.created_at)}</td>
                    <td className="px-5 py-2.5 ink-2">{formatDate(entry.notified_at)}</td>
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
