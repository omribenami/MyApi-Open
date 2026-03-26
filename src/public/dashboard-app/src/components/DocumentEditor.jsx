import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import DOMPurify from 'dompurify';

const SOURCE_OPTIONS = [
  { value: 'memory', label: 'Memory' },
  { value: 'persona', label: 'Persona' },
  { value: 'user-profile', label: 'User Profile' },
  { value: 'general', label: 'General' },
  { value: 'notes', label: 'Notes' },
  { value: 'custom', label: 'Custom' },
];

function renderMarkdown(text) {
  if (!text) return '<p class="text-slate-500 italic">Nothing to preview yet...</p>';

  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (before inline code)
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    return `<pre class="bg-slate-950 border border-slate-700 p-3 rounded-lg my-3 overflow-x-auto text-sm"><code class="text-green-300">${code.trim()}</code></pre>`;
  });

  // Headers
  html = html
    .replace(/^#### (.+)$/gm, '<h4 class="text-sm font-bold text-white mt-3 mb-1">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-blue-300 mt-5 mb-2 border-b border-slate-700 pb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-6 mb-3 border-b border-slate-600 pb-2">$1</h1>');

  // Bold & Italic (order matters)
  html = html
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-blue-300 text-sm font-mono">$1</code>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-blue-500 pl-4 my-2 text-slate-400 italic">$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-slate-600 my-4">');

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li class="ml-4 text-slate-300 flex gap-2"><span class="text-blue-400 mt-1">•</span><span>$1</span></li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-slate-300">$1</li>');

  // Links
  html = html.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" class="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Paragraphs
  html = html
    .replace(/\n\n+/g, '</p><p class="my-2 text-slate-300 leading-relaxed">')
    .replace(/\n/g, '<br>');

  const rawHtml = `<div class="text-slate-300 leading-relaxed"><p class="my-2">${html}</p></div>`;
  return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
}

function DocumentEditor() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const {
    showEditor,
    pendingDocumentData,
    closeEditor,
    addDocument,
    setSuccess,
  } = useKnowledgeStore();

  const [title, setTitle] = useState('');
  const [source, setSource] = useState('general');
  const [customSource, setCustomSource] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [previewMode, setPreviewMode] = useState('split'); // 'editor' | 'split' | 'preview'

  useEffect(() => {
    if (showEditor && pendingDocumentData) {
      setTitle(pendingDocumentData.title || '');
      setSource(pendingDocumentData.source || 'general');
      setContent(pendingDocumentData.content || '');
    }
  }, [showEditor, pendingDocumentData]);

  const handleClose = () => {
    if (content.trim() || title.trim()) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    resetForm();
    closeEditor();
  };

  const resetForm = () => {
    setTitle('');
    setSource('general');
    setCustomSource('');
    setContent('');
    setLocalError(null);
    setSaving(false);
  };

  const handleSave = async () => {
    setLocalError(null);

    if (!title.trim()) {
      setLocalError('Title is required');
      return;
    }
    if (!content.trim()) {
      setLocalError('Content is required');
      return;
    }

    const finalSource = source === 'custom' ? customSource.trim() : source;
    if (source === 'custom' && !customSource.trim()) {
      setLocalError('Custom source name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/v1/brain/knowledge-base', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${masterToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: finalSource,
          title: title.trim(),
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create document');
      }

      const data = await response.json();
      addDocument({
        id: data.id,
        source: finalSource,
        title: title.trim(),
        metadata: { wordCount: content.split(/\s+/).length },
        createdAt: new Date().toISOString(),
        documentsCreated: data.documentsCreated,
      });

      setSuccess(`Document "${title.trim()}" created successfully (${data.documentsCreated} chunk${data.documentsCreated !== 1 ? 's' : ''})`);
      resetForm();
      closeEditor();
    } catch (err) {
      console.error('Save document error:', err);
      setLocalError(err.message || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  if (!showEditor) return null;

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-slate-900 border-b border-slate-700">
        <button
          onClick={handleClose}
          disabled={saving}
          className="text-slate-400 hover:text-white text-xl leading-none disabled:opacity-50 flex-shrink-0"
          title="Close editor"
        >
          ✕
        </button>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title..."
            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            disabled={saving}
          />

          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-shrink-0"
            disabled={saving}
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {source === 'custom' && (
            <input
              type="text"
              value={customSource}
              onChange={(e) => setCustomSource(e.target.value)}
              placeholder="Custom source name..."
              className="w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={saving}
            />
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 flex-shrink-0">
          {[
            { value: 'editor', label: '✏️', title: 'Editor only' },
            { value: 'split', label: '⬜', title: 'Split view' },
            { value: 'preview', label: '👁', title: 'Preview only' },
          ].map((mode) => (
            <button
              key={mode.value}
              onClick={() => setPreviewMode(mode.value)}
              title={mode.title}
              className={`px-2 py-1 rounded text-sm transition-colors ${
                previewMode === mode.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm flex-shrink-0"
        >
          {saving ? 'Saving...' : 'Save Document'}
        </button>
      </div>

      {/* Error bar */}
      {localError && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-900 bg-opacity-30 border-b border-red-700">
          <p className="text-red-300 text-sm">{localError}</p>
          <button
            onClick={() => setLocalError(null)}
            className="text-red-400 hover:text-red-300 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Editor / Preview area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor pane */}
        {(previewMode === 'editor' || previewMode === 'split') && (
          <div
            className={`flex flex-col ${
              previewMode === 'split' ? 'w-1/2 border-r border-slate-700' : 'w-full'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                Markdown
              </span>
              <span className="text-xs text-slate-600">
                {wordCount} words · {charCount} chars
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`# Document Title\n\nStart writing your document content in Markdown...\n\n## Section\n\nYour content here.`}
              className="flex-1 w-full p-4 bg-slate-950 text-slate-200 font-mono text-sm resize-none focus:outline-none leading-relaxed placeholder-slate-700"
              disabled={saving}
              autoFocus
            />
          </div>
        )}

        {/* Preview pane */}
        {(previewMode === 'preview' || previewMode === 'split') && (
          <div
            className={`flex flex-col ${
              previewMode === 'split' ? 'w-1/2' : 'w-full'
            }`}
          >
            <div className="flex items-center px-4 py-2 bg-slate-900 border-b border-slate-700">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                Preview
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer status */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-t border-slate-700 text-xs text-slate-600">
        <span>
          Source: <span className="text-slate-400">{source === 'custom' ? customSource || 'custom' : source}</span>
        </span>
        <span>Markdown supported</span>
      </div>
    </div>
  );
}

export default DocumentEditor;
