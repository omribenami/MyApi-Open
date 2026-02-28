import { useState } from 'react';
import { useKnowledgeStore } from '../stores/knowledgeStore';

const SOURCE_OPTIONS = [
  { value: 'memory', label: 'Memory' },
  { value: 'persona', label: 'Persona' },
  { value: 'user-profile', label: 'User Profile' },
  { value: 'general', label: 'General' },
  { value: 'notes', label: 'Notes' },
  { value: 'custom', label: 'Custom...' },
];

function CreateDocumentModal() {
  const { showCreateModal, closeCreateModal, openEditor } = useKnowledgeStore();

  const [title, setTitle] = useState('');
  const [source, setSource] = useState('general');
  const [customSource, setCustomSource] = useState('');
  const [localError, setLocalError] = useState(null);

  const handleOpenEditor = () => {
    setLocalError(null);
    if (!title.trim()) {
      setLocalError('Please enter a document title');
      return;
    }
    const finalSource = source === 'custom' ? customSource.trim() : source;
    if (source === 'custom' && !customSource.trim()) {
      setLocalError('Please enter a custom source name');
      return;
    }
    closeCreateModal();
    openEditor({ title: title.trim(), source: finalSource });
    setTitle('');
    setSource('general');
    setCustomSource('');
    setLocalError(null);
  };

  const handleClose = () => {
    setTitle('');
    setSource('general');
    setCustomSource('');
    setLocalError(null);
    closeCreateModal();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleOpenEditor();
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!showCreateModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4 border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <h2 className="text-lg font-bold text-white">New Document</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {localError && (
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
              {localError}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Document Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Project Notes, Meeting Summary..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Source / Category
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {source === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Custom Source Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., work, personal, research..."
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <p className="text-xs text-slate-500">
            After clicking <span className="text-slate-400 font-medium">Open Editor</span>, you can write your document content with Markdown and see a live preview.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleOpenEditor}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
          >
            <span>✏️</span>
            Open Editor
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateDocumentModal;
