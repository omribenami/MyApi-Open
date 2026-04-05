import { useState, useEffect, useRef } from 'react';
import apiClient from '../utils/apiClient';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SOURCE_COLORS = {
  user:             'bg-blue-500/20 text-blue-300 border-blue-500/30',
  chatgpt:          'bg-green-500/20 text-green-300 border-green-500/30',
  claude:           'bg-purple-500/20 text-purple-300 border-purple-500/30',
  jarvis:           'bg-orange-500/20 text-orange-300 border-orange-500/30',
  gemini:           'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'github copilot': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  api:              'bg-slate-600/30 text-slate-400 border-slate-600/30',
};

function sourceBadgeClass(source) {
  const key = (source || 'user').toLowerCase();
  return SOURCE_COLORS[key] || 'bg-slate-600/30 text-slate-400 border-slate-600/30';
}

function SourceBadge({ source }) {
  const label = source || 'user';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${sourceBadgeClass(label)} whitespace-nowrap`}>
      {label}
    </span>
  );
}

function EditModal({ mem, onClose, onSave }) {
  const [draft, setDraft] = useState(mem.content);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, []);

  async function handleSave() {
    if (!draft.trim()) return;
    setSaving(true);
    await onSave(mem.id, draft.trim());
    setSaving(false);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-200">Edit Memory</span>
            <SourceBadge source={mem.source} />
          </div>
          <span className="text-xs text-slate-500">{formatDate(mem.created_at)}</span>
        </div>

        {/* Editor — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-full min-h-[400px] bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 font-mono resize-none focus:outline-none focus:border-blue-500 leading-relaxed"
            style={{ minHeight: '400px' }}
          />
          <p className="mt-1.5 text-xs text-slate-600">⌘↵ to save · Esc to cancel</p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-slate-800">
          <button
            onClick={handleSave}
            disabled={saving || !draft.trim() || draft === mem.content}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryRow({ mem, onDelete, onEdit }) {
  const isLong = mem.content.length > 160 || mem.content.includes('\n');
  const preview = isLong
    ? mem.content.slice(0, 160).trimEnd() + '…'
    : mem.content;

  return (
    <tr className="group border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
      {/* Timestamp */}
      <td className="px-4 py-3 align-top whitespace-nowrap">
        <span className="text-xs text-slate-500 tabular-nums">{formatDate(mem.created_at)}</span>
      </td>

      {/* Content */}
      <td className="px-4 py-3 align-top">
        <div
          className="cursor-pointer"
          onClick={() => onEdit(mem)}
          title="Click to edit"
        >
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap hover:text-slate-100 transition-colors">
            {preview}
          </p>
          {isLong && (
            <span className="text-xs text-blue-400/70 hover:text-blue-400 mt-0.5 inline-block">
              View / edit full content
            </span>
          )}
        </div>
      </td>

      {/* Source */}
      <td className="px-4 py-3 align-top">
        <SourceBadge source={mem.source} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3 align-top">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(mem)}
            className="p-1.5 rounded text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(mem.id)}
            className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Memory() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingMem, setEditingMem] = useState(null);
  const fileRef = useRef(null);

  async function load() {
    try {
      const res = await apiClient.get('/memory');
      setMemories(res.data.data || []);
    } catch {
      setError('Failed to load memories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.post('/memory', { content: newContent.trim(), source: 'user' });
      setMemories(prev => [res.data.data, ...prev]);
      setNewContent('');
      setAdding(false);
    } catch {
      alert('Failed to add memory');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(id, content) {
    try {
      const res = await apiClient.patch(`/memory/${id}`, { content });
      setMemories(prev => prev.map(m => m.id === id ? { ...m, content: res.data.data.content } : m));
    } catch {
      alert('Failed to update memory');
    }
  }

  async function handleDelete(id) {
    try {
      await apiClient.delete(`/memory/${id}`);
      setMemories(prev => prev.filter(m => m.id !== id));
      if (editingMem?.id === id) setEditingMem(null);
    } catch {
      alert('Failed to delete memory');
    }
  }

  async function handleClearAll() {
    if (!window.confirm(`Delete all ${memories.length} memories? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await apiClient.delete('/memory');
      setMemories([]);
      setEditingMem(null);
    } catch {
      alert('Failed to clear memories');
    } finally {
      setClearing(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      // Store entire file content as a single memory entry
      const res = await apiClient.post('/memory', {
        content: text.trim(),
        source: 'user',
      });
      setMemories(prev => [res.data.data, ...prev]);
    } catch {
      alert('Failed to import file.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Edit modal */}
      {editingMem && (
        <EditModal
          mem={editingMem}
          onClose={() => setEditingMem(null)}
          onSave={handleSave}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Memory</h1>
          <p className="mt-1 text-slate-400 text-sm max-w-2xl">
            Long-term memory shared with every AI assistant connected to your account.
            AI agents (ChatGPT, Claude, etc.) can add memories automatically — they appear here with their source badge.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt,.json"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? 'Uploading…' : 'Upload file'}
          </button>
          <button
            onClick={() => { setAdding(true); setNewContent(''); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add memory
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-4 space-y-3">
          <p className="text-xs text-slate-500">Write a memory or paste a full MEMORY.md document. Markdown supported.</p>
          <textarea
            autoFocus
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setAdding(false); setNewContent(''); }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
            }}
            rows={5}
            placeholder="e.g. User prefers concise responses. Timezone is UTC+2."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono resize-y focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2 items-center">
            <button
              onClick={handleAdd}
              disabled={saving || !newContent.trim()}
              className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewContent(''); }}
              className="px-4 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <span className="text-xs text-slate-600">⌘↵ to save · Esc to cancel</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-800">
              <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium whitespace-nowrap w-44">Added</th>
              <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium">Content</th>
              <th className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium whitespace-nowrap w-28">Source</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-red-400">{error}</td></tr>
            ) : memories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <p className="text-slate-400 text-sm">No memories yet.</p>
                  <p className="text-slate-600 text-xs mt-1">Add one manually, upload a MEMORY.md file, or let a connected AI create them automatically.</p>
                </td>
              </tr>
            ) : (
              memories.map(mem => (
                <MemoryRow key={mem.id} mem={mem} onDelete={handleDelete} onEdit={setEditingMem} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {memories.length > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-600">{memories.length} {memories.length === 1 ? 'entry' : 'entries'}</p>
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="text-xs text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Clear all memories'}
          </button>
        </div>
      )}
    </div>
  );
}
