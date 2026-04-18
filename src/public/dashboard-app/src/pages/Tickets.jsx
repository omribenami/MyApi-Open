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

const STATUS_COLORS = {
  open:       'bg-amber-900/40 text-amber-200 border border-amber-700/50',
  inprogress: 'bg-blue-900/40 text-blue-200 border border-blue-700/50',
  closed:     'bg-emerald-900/40 text-emerald-200 border border-emerald-700/50',
};

const SOURCE_COLORS = {
  discord: 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50',
  manual:  'bg-slate-800/60 text-slate-400 border border-slate-600/50',
  api:     'bg-violet-900/40 text-violet-300 border border-violet-700/50',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.open}`}>
      {status === 'inprogress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SourceBadge({ source }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs ${SOURCE_COLORS[source] || SOURCE_COLORS.manual}`}>
      {source}
    </span>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    amber:   'text-amber-400',
    blue:    'text-blue-400',
    emerald: 'text-emerald-400',
  };
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className={`text-2xl font-bold ${colors[color] || 'text-white'}`}>{value}</div>
      <div className="text-slate-400 text-sm mt-1">{label}</div>
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

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">New Ticket</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Source</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm min-h-[44px]">
                <option value="manual">Manual</option>
                <option value="discord">Discord</option>
                <option value="api">API</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Complainer</label>
            <input type="text" value={form.complainer} onChange={e => set('complainer', e.target.value)}
              placeholder="Discord username or handle"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Complaint <span className="text-red-400">*</span></label>
            <textarea value={form.complaint} onChange={e => set('complaint', e.target.value)}
              rows={3} required placeholder="What is the complaint?"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">How to Recreate</label>
            <textarea value={form.repro_steps} onChange={e => set('repro_steps', e.target.value)}
              rows={3} placeholder="Steps to reproduce..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm min-h-[44px]">
                <option value="open">Open</option>
                <option value="inprogress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Fix Commit</label>
              <input type="text" value={form.fix_commit} onChange={e => set('fix_commit', e.target.value)}
                placeholder="commit hash or PR link"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
            </div>
          </div>
          {form.source === 'discord' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Discord Message ID</label>
              <input type="text" value={form.source_message_id} onChange={e => set('source_message_id', e.target.value)}
                placeholder="optional"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm" />
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:text-white text-sm min-h-[44px]">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium min-h-[44px] disabled:opacity-50">
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

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Tickets</h1>
            <p className="text-slate-400 text-sm mt-1">Complaint tracking — AI agent and manual triage</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium min-h-[44px]">
            + New Ticket
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Open" value={open} color="amber" />
          <StatCard label="In Progress" value={inprogress} color="blue" />
          <StatCard label="Closed" value={closed} color="emerald" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm min-h-[44px]">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="inprogress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
          <button onClick={fetchTickets} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm min-h-[44px]">
            Refresh
          </button>
        </div>

        {/* Errors */}
        {actionError && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-red-300 text-sm">
            {actionError}
          </div>
        )}

        {/* Table */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading…</div>
          ) : loadError ? (
            <div className="p-8 text-center text-red-400">{loadError}</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No tickets yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Complainer</th>
                    <th className="text-left px-4 py-3">Complaint</th>
                    <th className="text-left px-4 py-3">Repro</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Fix Commit</th>
                    <th className="text-left px-4 py-3">Source</th>
                    <th className="text-left px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {ticket.date ? new Date(ticket.date * 1000).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-200 max-w-[120px] truncate" title={ticket.complainer || ''}>
                        {ticket.complainer || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-200 max-w-[200px]">
                        <span title={ticket.complaint || ''}>
                          {ticket.complaint ? (ticket.complaint.length > 120 ? ticket.complaint.slice(0, 120) + '…' : ticket.complaint) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-[160px]">
                        <span title={ticket.repro_steps || ''}>
                          {ticket.repro_steps ? (ticket.repro_steps.length > 80 ? ticket.repro_steps.slice(0, 80) + '…' : ticket.repro_steps) : <span className="text-slate-600">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          key={ticket.id + '-status'}
                          defaultValue={ticket.status}
                          onChange={e => updateTicket(ticket.id, { status: e.target.value })}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 text-xs min-h-[32px]">
                          <option value="open">Open</option>
                          <option value="inprogress">In Progress</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          key={ticket.id + '-commit'}
                          type="text"
                          defaultValue={ticket.fix_commit || ''}
                          onBlur={e => {
                            const val = e.target.value;
                            if (val !== (ticket.fix_commit || '')) updateTicket(ticket.id, { fix_commit: val });
                          }}
                          placeholder="commit / PR"
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs w-36 placeholder-slate-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <SourceBadge source={ticket.source} />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteTicket(ticket.id)}
                          className="text-slate-600 hover:text-red-400 transition-colors text-xs px-2 py-1 min-h-[32px]">
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
