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

function BroadcastPreview({ title, message, target }) {
  const showBell = target === 'bell' || target === 'both';
  const showCard = target === 'attention' || target === 'both';
  const titleText = title || 'Your announcement title';
  const msgText = message || 'Your message will appear here.';

  return (
    <div className="space-y-4">
      {showBell && (
        <div>
          <div className="micro mb-2" style={{ color: 'var(--ink-3)' }}>BELL PREVIEW</div>
          <div className="ui-card p-3" style={{ maxWidth: 320 }}>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="ink text-[13px] font-medium leading-snug truncate">{titleText}</div>
                <div className="ink-2 text-[12px] mt-0.5 leading-relaxed line-clamp-2">{msgText}</div>
                <div className="micro mt-1">just now</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCard && (
        <div>
          <div className="micro mb-2" style={{ color: 'var(--ink-3)' }}>ATTENTION CARD PREVIEW</div>
          <div className="ui-card p-5 relative overflow-hidden" style={{ maxWidth: 320 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, height: '2px', width: '40px', background: 'var(--accent)' }} />
            <div className="micro mb-2" style={{ color: 'var(--accent)' }}>ANNOUNCEMENT</div>
            <div className="font-serif ink" style={{ fontSize: 17, lineHeight: 1.3 }}>{titleText}</div>
            <p className="ink-2 mt-2" style={{ fontSize: 13.5 }}>{msgText}</p>
            <span className="mt-4 text-[12.5px] ink underline underline-offset-4 block opacity-50 cursor-default">Dismiss →</span>
          </div>
        </div>
      )}
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

  // Broadcast state
  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcTarget, setBcTarget] = useState('both');
  const [bcSending, setBcSending] = useState(false);
  const [bcError, setBcError] = useState('');
  const [bcSuccess, setBcSuccess] = useState('');

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const sendBroadcast = async () => {
    setBcError('');
    setBcSuccess('');
    if (!bcTitle.trim()) { setBcError('Title is required.'); return; }
    if (!bcMessage.trim()) { setBcError('Message is required.'); return; }
    if (!window.confirm(`Send "${bcTitle}" to all users?`)) return;
    setBcSending(true);
    try {
      const opts = {
        ...authOptions(),
        method: 'POST',
        headers: { ...(authOptions().headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bcTitle.trim(), message: bcMessage.trim(), target: bcTarget }),
      };
      const data = await apiRequest('/api/v1/admin/broadcast-notification', opts);
      setBcSuccess(`Sent to ${data?.sent ?? 0} users.`);
      setBcTitle('');
      setBcMessage('');
    } catch (err) {
      setBcError(err.message || 'Failed to send broadcast');
    } finally {
      setBcSending(false);
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

      {/* Broadcast section */}
      <div className="ui-card p-5 space-y-4">
        <div>
          <h2 className="ink font-semibold" style={{ fontSize: 15 }}>Broadcast notification</h2>
          <p className="ui-subtitle leading-relaxed mt-1">
            Push a custom message to every user — appears in the bell menu, as an Attention card, or both.
          </p>
        </div>

        {/* Target toggle */}
        <div className="flex gap-2 flex-wrap">
          {[['both', 'Both'], ['bell', 'Bell only'], ['attention', 'Attention card only']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setBcTarget(val)}
              className="ui-button text-[12px]"
              style={bcTarget === val ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-bg)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Form + preview side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <label className="micro">TITLE</label>
                <span className="micro" style={{ color: bcTitle.length > 72 ? 'var(--amber)' : 'var(--ink-4)' }}>{bcTitle.length}/80</span>
              </div>
              <input
                type="text"
                maxLength={80}
                value={bcTitle}
                onChange={(e) => setBcTitle(e.target.value)}
                placeholder="e.g. Scheduled maintenance this Friday"
                className="ui-input w-full"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="micro">MESSAGE</label>
                <span className="micro" style={{ color: bcMessage.length > 270 ? 'var(--amber)' : 'var(--ink-4)' }}>{bcMessage.length}/300</span>
              </div>
              <textarea
                maxLength={300}
                value={bcMessage}
                onChange={(e) => setBcMessage(e.target.value)}
                placeholder="Brief description shown to all users."
                rows={4}
                className="ui-input w-full resize-none"
                style={{ fontFamily: 'inherit' }}
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <button
                type="button"
                disabled={bcSending || !bcTitle.trim() || !bcMessage.trim()}
                onClick={sendBroadcast}
                className="ui-button text-[13px]"
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
              >
                {bcSending ? 'Sending…' : 'Send to all users'}
              </button>
              {bcSuccess && <span className="text-[13px]" style={{ color: 'var(--green)' }}>{bcSuccess}</span>}
              {bcError   && <span className="text-[13px]" style={{ color: 'var(--red)' }}>{bcError}</span>}
            </div>
          </div>

          {/* Live preview */}
          <BroadcastPreview title={bcTitle} message={bcMessage} target={bcTarget} />
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
