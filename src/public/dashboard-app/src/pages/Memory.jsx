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

function SourceBadge({ source }) {
  return (
    <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: '10.5px', padding: '1px 6px', border: '1px solid var(--line)', background: 'var(--bg-sunk)', color: 'var(--ink-3)', borderRadius: '3px' }}>
      {source || 'user'}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col" style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', borderRadius: '6px' }}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line-2)' }}>
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium ink">Edit Memory</span>
            <SourceBadge source={mem.source} />
          </div>
          <span className="text-[12px] ink-4">{formatDate(mem.created_at)}</span>
        </div>

        {/* Editor — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="ui-input w-full font-mono resize-none leading-relaxed"
            rows={6}
            style={{ minHeight: '400px' }}
          />
          <p className="mt-1.5 text-[12px] ink-4">⌘↵ to save · Esc to cancel</p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4" style={{ borderTop: '1px solid var(--line-2)' }}>
          <button
            onClick={handleSave}
            disabled={saving || !draft.trim() || draft === mem.content}
            className="btn btn-primary text-[13px]"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={onClose}
            className="btn text-[13px]"
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
    <div className="p-5 grid grid-cols-12 gap-4 items-start group" style={{ borderTop: '1px solid var(--line-2)' }}>
      {/* Timestamp */}
      <div className="col-span-2">
        <span className="micro tabular-nums">{formatDate(mem.created_at)}</span>
      </div>

      {/* Content */}
      <div className="col-span-8">
        <div
          className="cursor-pointer"
          onClick={() => onEdit(mem)}
          title="Click to edit"
        >
          <p className="ink text-[14px] leading-relaxed whitespace-pre-wrap">
            {preview}
          </p>
          {isLong && (
            <span className="text-[12px] mt-0.5 inline-block" style={{ color: 'var(--accent)' }}>
              View / edit full content
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <SourceBadge source={mem.source} />
        </div>
      </div>

      {/* Actions */}
      <div className="col-span-2 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(mem)}
          className="p-1.5 rounded ink-4 transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-bg)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.background = 'transparent'; }}
          title="Edit"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(mem.id)}
          className="btn btn-ghost text-[12px] p-1.5 rounded"
          style={{ color: 'var(--red)' }}
          title="Forget"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
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
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">AI BRAIN · MEMORY</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">What every persona has learned.</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Long-lived facts agents have stored about you. Each memory is scoped to a persona and can be forgotten one at a time.</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
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
            className="btn text-[13px] flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? 'Uploading…' : 'Upload file'}
          </button>
          <button
            onClick={() => { setAdding(true); setNewContent(''); }}
            className="btn btn-primary text-[13px] flex items-center gap-1.5"
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
        <div className="card p-4 space-y-3" style={{ border: '1px solid var(--accent)', borderRadius: '6px' }}>
          <p className="text-[12px] ink-4">Write a memory or paste a full MEMORY.md document. Markdown supported.</p>
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
            className="ui-input w-full font-mono resize-y text-[13px]"
          />
          <div className="flex gap-2 items-center">
            <button
              onClick={handleAdd}
              disabled={saving || !newContent.trim()}
              className="btn btn-primary text-[13px]"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewContent(''); }}
              className="btn text-[13px]"
            >
              Cancel
            </button>
            <span className="text-[12px] ink-4">⌘↵ to save · Esc to cancel</span>
          </div>
        </div>
      )}

      {/* Memory list */}
      <div className="card divide-y" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table header */}
        <div className="p-3 px-5 grid grid-cols-12 gap-4" style={{ background: 'var(--bg-sunk)', borderBottom: '1px solid var(--line)' }}>
          <div className="col-span-2 micro">Added</div>
          <div className="col-span-8 micro">Content</div>
          <div className="col-span-2"></div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-[13px] ink-3">Loading…</div>
        ) : error ? (
          <div className="p-10 text-center text-[13px]" style={{ color: 'var(--red)' }}>{error}</div>
        ) : memories.length === 0 ? (
          <div className="p-12 text-center">
            <p className="ink-2 text-[14px]">No memories yet.</p>
            <p className="ink-4 text-[12px] mt-1">Add one manually, upload a MEMORY.md file, or let a connected AI create them automatically.</p>
          </div>
        ) : (
          memories.map(mem => (
            <MemoryRow key={mem.id} mem={mem} onDelete={handleDelete} onEdit={setEditingMem} />
          ))
        )}
      </div>

      {/* Footer */}
      {memories.length > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-[12px] ink-4">{memories.length} {memories.length === 1 ? 'entry' : 'entries'}</p>
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="text-[12px] ink-4 transition-colors disabled:opacity-50"
            style={{ background: 'none', border: 'none' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = ''; }}
          >
            {clearing ? 'Clearing…' : 'Clear all memories'}
          </button>
        </div>
      )}
    </div>
  );
}
