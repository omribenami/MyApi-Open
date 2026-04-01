import { useState, useEffect, useRef } from 'react';
import apiClient from '../utils/apiClient';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function MemoryRow({ mem, onDelete, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(mem.content);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [editing]);

  async function handleSave() {
    if (!draft.trim() || draft.trim() === mem.content) { setEditing(false); setDraft(mem.content); return; }
    setSaving(true);
    await onSave(mem.id, draft.trim());
    setSaving(false);
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setEditing(false); setDraft(mem.content); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  }

  return (
    <div className="group flex gap-3 px-4 py-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors">
      {/* timestamp */}
      <span className="flex-shrink-0 text-xs text-slate-500 w-36 pt-0.5 tabular-nums">
        {formatDate(mem.created_at)}
      </span>

      {/* content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={Math.max(2, draft.split('\n').length)}
              className="w-full bg-slate-800 border border-blue-500/50 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !draft.trim()}
                className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setDraft(mem.content); }}
                className="px-3 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <span className="text-xs text-slate-600 pt-1">⌘↵ to save · Esc to cancel</span>
            </div>
          </div>
        ) : (
          <p
            onClick={() => setEditing(true)}
            className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap cursor-text hover:text-slate-100 transition-colors"
          >
            {mem.content}
          </p>
        )}
      </div>

      {/* delete */}
      {!editing && (
        <button
          onClick={() => onDelete(mem.id)}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1 rounded"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
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
      const res = await apiClient.post('/memory', { content: newContent.trim() });
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
      setMemories(prev => prev.map(m => m.id === id ? { ...m, content } : m));
    } catch {
      alert('Failed to update memory');
    }
  }

  async function handleDelete(id) {
    try {
      await apiClient.delete(`/memory/${id}`);
      setMemories(prev => prev.filter(m => m.id !== id));
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
      // Split by lines, filter out frontmatter, blank lines, and markdown headers
      const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && l !== '---' && l !== '```');

      if (!lines.length) { alert('No memory entries found in file.'); setImporting(false); return; }

      let added = 0;
      const newMems = [];
      for (const line of lines) {
        try {
          const res = await apiClient.post('/memory', { content: line });
          newMems.push(res.data.data);
          added++;
        } catch { /* skip bad lines */ }
      }
      setMemories(prev => [...newMems.reverse(), ...prev]);
      alert(`Imported ${added} memory ${added === 1 ? 'entry' : 'entries'}.`);
    } catch {
      alert('Failed to import file.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Memory</h1>
          <p className="mt-1 text-slate-400 text-sm max-w-2xl">
            Long-term memory shared with every AI assistant that connects to your account.
            AI agents (like ChatGPT) can add memories automatically — they appear here in real time.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt"
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
            {importing ? 'Importing…' : 'Import .md'}
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
          <p className="text-xs text-slate-500">Write the memory entry. Plain text or markdown supported.</p>
          <textarea
            autoFocus
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setNewContent(''); } if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd(); }}
            rows={3}
            placeholder="e.g. User prefers concise responses. Timezone is UTC+2."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono resize-none focus:outline-none focus:border-blue-500"
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

      {/* List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="flex gap-3 px-4 py-2 bg-slate-800/50 border-b border-slate-800">
          <span className="text-xs text-slate-500 w-36 flex-shrink-0">Added</span>
          <span className="text-xs text-slate-500 flex-1">Content</span>
        </div>

        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">Loading…</div>
        ) : error ? (
          <div className="px-4 py-10 text-center text-sm text-red-400">{error}</div>
        ) : memories.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-slate-400 text-sm">No memories yet.</p>
            <p className="text-slate-600 text-xs mt-1">Add one manually or let a connected AI assistant create them automatically.</p>
          </div>
        ) : (
          memories.map(mem => (
            <MemoryRow key={mem.id} mem={mem} onDelete={handleDelete} onSave={handleSave} />
          ))
        )}
      </div>

      {/* Footer actions */}
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
