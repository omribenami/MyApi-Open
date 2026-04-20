import { useEffect, useState, useCallback } from 'react';
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

function formatError(err, fallback) {
  if (err?.status === 429) return 'Too many requests. Please wait a moment and retry.';
  if (err?.status >= 500) return (typeof err?.payload === 'object' ? err?.payload?.error : '') || 'Internal server error.';
  return err?.message || fallback;
}

function StatusBadge({ status }) {
  const styles = {
    open:       { borderColor: 'var(--amber)',   background: 'var(--amber-bg,rgba(245,158,11,0.12))',  color: 'var(--amber)' },
    inprogress: { borderColor: 'var(--accent)',  background: 'var(--accent-bg)',                      color: 'var(--accent)' },
    closed:     { borderColor: 'var(--green)',   background: 'var(--green-bg)',                       color: 'var(--green)' },
  };
  const s = styles[status] || styles.open;
  const label = status === 'inprogress' ? 'In Progress' : (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Open');
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium"
      style={s}
    >
      {label}
    </span>
  );
}

function SourceBadge({ source }) {
  const styles = {
    discord: { borderColor: 'var(--accent)',  background: 'var(--accent-bg)',  color: 'var(--accent)' },
    api:     { borderColor: 'var(--line)',     background: 'var(--bg-raised)', color: 'var(--ink-2)' },
    manual:  { borderColor: 'var(--line)',     background: 'var(--bg-raised)', color: 'var(--ink-3)' },
  };
  const s = styles[source] || styles.manual;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium"
      style={s}
    >
      {source || 'manual'}
    </span>
  );
}

function StatCard({ label, value, color }) {
  const colorMap = {
    amber:   'var(--amber)',
    blue:    'var(--accent)',
    emerald: 'var(--green)',
  };
  return (
    <div className="ui-card px-4 py-3 min-w-[88px]">
      <div className="micro mb-1">{label}</div>
      <div className="font-semibold" style={{ fontSize: 22, color: colorMap[color] || 'var(--ink)' }}>{value}</div>
    </div>
  );
}

function CreateTicketModal({ masterToken, onClose, onCreated }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    complainer: '',
    complaint: '',
    repro_steps: '',
    status: 'open',
    fix_commit: '',
    source: 'manual',
    source_message_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const options = {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}) },
        body: JSON.stringify({
          ...form,
          date: form.date ? Math.floor(new Date(form.date).getTime() / 1000) : undefined,
          fix_commit: form.fix_commit || undefined,
          source_message_id: form.source_message_id || undefined,
        }),
      };
      const data = await apiRequest('/api/v1/tickets', options);
      onCreated(data.data);
    } catch (err) {
      setError(formatError(err, 'Failed to create ticket'));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'var(--bg-sunk)',
    border: '1px solid var(--line)',
    color: 'var(--ink)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg rounded" style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line)' }}>
          <h2 className="ink font-semibold" style={{ fontSize: 15 }}>New Ticket</h2>
          <button onClick={onClose} className="ink-3 hover:ink text-xl leading-none" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="micro mb-1 block">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="micro mb-1 block">Source</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}
                style={{ ...inputStyle, minHeight: 44 }}>
                <option value="manual">Manual</option>
                <option value="discord">Discord</option>
                <option value="api">API</option>
              </select>
            </div>
          </div>
          <div>
            <label className="micro mb-1 block">Complainer</label>
            <input type="text" value={form.complainer} onChange={e => set('complainer', e.target.value)}
              placeholder="Discord username or handle" style={inputStyle} />
          </div>
          <div>
            <label className="micro mb-1 block">Complaint <span style={{ color: 'var(--red)' }}>*</span></label>
            <textarea value={form.complaint} onChange={e => set('complaint', e.target.value)}
              rows={3} required placeholder="What is the complaint?"
              style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div>
            <label className="micro mb-1 block">How to Recreate</label>
            <textarea value={form.repro_steps} onChange={e => set('repro_steps', e.target.value)}
              rows={3} placeholder="Steps to reproduce..."
              style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="micro mb-1 block">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                style={{ ...inputStyle, minHeight: 44 }}>
                <option value="open">Open</option>
                <option value="inprogress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="micro mb-1 block">Fix Commit</label>
              <input type="text" value={form.fix_commit} onChange={e => set('fix_commit', e.target.value)}
                placeholder="commit hash or PR link" style={inputStyle} />
            </div>
          </div>
          {form.source === 'discord' && (
            <div>
              <label className="micro mb-1 block">Discord Message ID</label>
              <input type="text" value={form.source_message_id} onChange={e => set('source_message_id', e.target.value)}
                placeholder="optional" style={inputStyle} />
            </div>
          )}
          {error && <p className="text-[13px]" style={{ color: 'var(--red)' }}>{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="ui-button flex-1 min-h-[44px]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="ui-button-primary flex-1 min-h-[44px] disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Tickets() {
  const masterToken = useAuthStore((s) => s.masterToken);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const authHeaders = useCallback(() => ({
    credentials: 'include',
    ...(masterToken ? { headers: { Authorization: `Bearer ${masterToken}` } } : {}),
  }), [masterToken]);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setActionError('');
    try {
      const url = `/api/v1/tickets${statusFilter ? `?status=${statusFilter}` : ''}`;
      const data = await apiRequest(url, authHeaders());
      setTickets(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setLoadError(formatError(err, 'Failed to load tickets'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, authHeaders]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const updateTicket = async (id, patch) => {
    setActionError('');
    try {
      const opts = {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(masterToken ? { Authorization: `Bearer ${masterToken}` } : {}) },
        body: JSON.stringify(patch),
      };
      const data = await apiRequest(`/api/v1/tickets/${id}`, opts);
      setTickets(ts => ts.map(t => t.id === id ? data.data : t));
    } catch (err) {
      setActionError(formatError(err, 'Failed to update ticket'));
    }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm('Delete this ticket?')) return;
    setActionError('');
    try {
      await apiRequest(`/api/v1/tickets/${id}`, { method: 'DELETE', ...authHeaders() });
      setTickets(ts => ts.filter(t => t.id !== id));
    } catch (err) {
      setActionError(formatError(err, 'Failed to delete ticket'));
    }
  };

  const open = tickets.filter(t => t.status === 'open').length;
  const inprogress = tickets.filter(t => t.status === 'inprogress').length;
  const closed = tickets.filter(t => t.status === 'closed').length;

  const selectStyle = {
    background: 'var(--bg-sunk)',
    border: '1px solid var(--line)',
    color: 'var(--ink)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    minHeight: 32,
    outline: 'none',
  };

  const inlineInputStyle = {
    background: 'var(--bg-sunk)',
    border: '1px solid var(--line)',
    color: 'var(--ink-2)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    width: 144,
    outline: 'none',
  };

  return (
    <div className="ui-page">
      {/* Header */}
      <div className="ui-page-header">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="ui-title">Tickets</h1>
            <p className="ui-subtitle mt-1">Complaint tracking — AI agent and manual triage</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatCard label="OPEN"        value={open}        color="amber" />
            <StatCard label="IN PROGRESS" value={inprogress}  color="blue" />
            <StatCard label="CLOSED"      value={closed}       color="emerald" />
            <button onClick={() => setShowModal(true)} className="ui-button-primary min-h-[44px]">
              + New Ticket
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ ...selectStyle, minHeight: 44, fontSize: 13, padding: '6px 10px' }}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="inprogress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <button onClick={fetchTickets} className="ui-button min-h-[44px]">
          Refresh
        </button>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="ui-card p-3 text-[13px]" style={{ borderColor: 'var(--red)', color: 'var(--red)', background: 'var(--red-bg)' }}>
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="ui-card overflow-hidden">
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <span className="ink font-semibold text-[14px]">All Tickets ({tickets.length})</span>
        </div>

        {loading ? (
          <div className="p-6 ui-subtitle text-[13px]">Loading…</div>
        ) : loadError ? (
          <div className="p-6 text-[13px]" style={{ color: 'var(--red)' }}>{loadError}</div>
        ) : tickets.length === 0 ? (
          <div className="p-6 ui-subtitle text-[13px]">No tickets yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead style={{ background: 'var(--bg-sunk)', borderBottom: '1px solid var(--line)' }}>
                <tr>
                  {['Date', 'Complainer', 'Complaint', 'Repro', 'Status', 'Fix Commit', 'Source', ''].map((h, i) => (
                    <th key={i} className="text-left px-5 py-2.5 font-medium micro">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket, i) => (
                  <tr
                    key={ticket.id}
                    style={{ borderBottom: i < tickets.length - 1 ? '1px solid var(--line-2)' : 'none' }}
                  >
                    <td className="px-5 py-2.5 ink-2 whitespace-nowrap">
                      {ticket.date ? new Date(ticket.date * 1000).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-2.5 ink max-w-[120px] truncate" title={ticket.complainer || ''}>
                      {ticket.complainer || <span style={{ color: 'var(--ink-3)' }}>—</span>}
                    </td>
                    <td className="px-5 py-2.5 ink max-w-[200px]">
                      <span title={ticket.complaint || ''}>
                        {ticket.complaint ? (ticket.complaint.length > 120 ? ticket.complaint.slice(0, 120) + '…' : ticket.complaint) : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 ink-2 max-w-[160px]">
                      <span title={ticket.repro_steps || ''}>
                        {ticket.repro_steps ? (ticket.repro_steps.length > 80 ? ticket.repro_steps.slice(0, 80) + '…' : ticket.repro_steps) : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                      </span>
                    </td>
                    <td className="px-5 py-2.5">
                      <select
                        key={ticket.id + '-status'}
                        defaultValue={ticket.status}
                        onChange={e => updateTicket(ticket.id, { status: e.target.value })}
                        style={selectStyle}
                      >
                        <option value="open">Open</option>
                        <option value="inprogress">In Progress</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="px-5 py-2.5">
                      <input
                        key={ticket.id + '-commit'}
                        type="text"
                        defaultValue={ticket.fix_commit || ''}
                        onBlur={e => {
                          const val = e.target.value;
                          if (val !== (ticket.fix_commit || '')) updateTicket(ticket.id, { fix_commit: val });
                        }}
                        placeholder="commit / PR"
                        style={inlineInputStyle}
                      />
                    </td>
                    <td className="px-5 py-2.5">
                      <SourceBadge source={ticket.source} />
                    </td>
                    <td className="px-5 py-2.5">
                      <button
                        onClick={() => deleteTicket(ticket.id)}
                        className="btn btn-ghost text-[12px] min-h-[32px]"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <CreateTicketModal
          masterToken={masterToken}
          onClose={() => setShowModal(false)}
          onCreated={(ticket) => { setTickets(ts => [ticket, ...ts]); setShowModal(false); }}
        />
      )}
    </div>
  );
}
