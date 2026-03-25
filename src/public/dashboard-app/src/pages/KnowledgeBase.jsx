import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import DocumentEditor from '../components/DocumentEditor';
import CreateDocumentModal from '../components/CreateDocumentModal';
import DeleteDocumentConfirmation from '../components/DeleteDocumentConfirmation';

const SOURCE_COLORS = {
  memory: 'bg-purple-600 bg-opacity-20 text-purple-300 border-purple-700',
  persona: 'bg-green-600 bg-opacity-20 text-green-300 border-green-700',
  'user-profile': 'bg-blue-600 bg-opacity-20 text-blue-300 border-blue-700',
  general: 'bg-slate-600 bg-opacity-20 text-slate-300 border-slate-600',
  notes: 'bg-yellow-600 bg-opacity-20 text-yellow-300 border-yellow-700',
};

function getSourceColor(source) {
  return SOURCE_COLORS[source] || 'bg-indigo-600 bg-opacity-20 text-indigo-300 border-indigo-700';
}

function SourceBadge({ source }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${getSourceColor(source)}`}
    >
      {source}
    </span>
  );
}

function DocumentCard({ doc, onDelete, onEdit }) {
  const wordCount = doc.metadata?.wordCount || 0;
  const section = doc.metadata?.section;
  const chunkIndex = doc.metadata?.chunkIndex;

  return (
    <div 
      onClick={() => onEdit && onEdit(doc)}
      className="bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 group cursor-pointer"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2 group-hover:text-blue-300 transition-colors">
            {doc.title}
          </h3>
          {section && section !== 'General' && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              § {section}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
          className="flex-shrink-0 text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-900 hover:bg-opacity-20 opacity-0 group-hover:opacity-100"
          title="Delete document"
        >
          🗑️
        </button>
      </div>

      {/* Source badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <SourceBadge source={doc.source} />
        {chunkIndex !== undefined && (
          <span className="text-xs text-slate-600">chunk #{chunkIndex + 1}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-700 mt-auto">
        <span>
          {wordCount > 0 ? `${wordCount} words` : '—'}
        </span>
        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function DocumentRow({ doc, onDelete, onEdit }) {
  const wordCount = doc.metadata?.wordCount || 0;
  const section = doc.metadata?.section;

  return (
    <div 
      onClick={() => onEdit && onEdit(doc)}
      className="bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg px-5 py-3.5 flex items-center gap-4 transition-colors group cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-medium text-white text-sm truncate group-hover:text-blue-300 transition-colors">
            {doc.title}
          </span>
          {section && section !== 'General' && (
            <span className="text-xs text-slate-500 hidden sm:inline">§ {section}</span>
          )}
        </div>
      </div>

      <SourceBadge source={doc.source} />

      <span className="text-xs text-slate-500 hidden md:inline w-16 text-right">
        {wordCount > 0 ? `${wordCount}w` : '—'}
      </span>
      <span className="text-xs text-slate-500 hidden lg:inline w-24 text-right">
        {new Date(doc.createdAt).toLocaleDateString()}
      </span>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
        className="flex-shrink-0 text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-900 hover:bg-opacity-20 opacity-0 group-hover:opacity-100"
        title="Delete document"
      >
        🗑️
      </button>
    </div>
  );
}

function KnowledgeBase() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace);
  const {
    documents,
    isLoading,
    error,
    success,
    viewMode,
    searchQuery,
    sortBy,
    sortOrder,
    filterSource,
    setDocuments,
    setIsLoading,
    setError,
    setSuccess,
    clearError,
    clearSuccess,
    setViewMode,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    setFilterSource,
    openCreateModal,
    openDeleteConfirmation,
    openEditor,
  } = useKnowledgeStore();

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (masterToken) {
      fetchDocuments();
    }
  }, [masterToken, currentWorkspace?.id]);

  // Auto-clear messages
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => clearSuccess(), 4000);
      return () => clearTimeout(t);
    }
  }, [success, clearSuccess]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(t);
    }
  }, [error, clearError]);

  const fetchDocuments = async () => {
    if (!masterToken) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/brain/knowledge-base', {
        headers: { Authorization: `Bearer ${masterToken}` },
      });
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch KB documents error:', err);
      setError('Failed to load knowledge base documents');
    } finally {
      setIsLoading(false);
    }
  };

  // Derived: unique sources for filter dropdown
  const uniqueSources = useMemo(() => {
    const s = new Set(documents.map((d) => d.source));
    return Array.from(s).sort();
  }, [documents]);

  // Derived: stats
  const stats = useMemo(() => {
    const totalWords = documents.reduce((sum, d) => sum + (d.metadata?.wordCount || 0), 0);
    return {
      total: documents.length,
      sources: uniqueSources.length,
      words: totalWords,
    };
  }, [documents, uniqueSources]);

  // Derived: filtered + sorted documents
  const displayDocuments = useMemo(() => {
    let result = [...documents];

    // Filter by source
    if (filterSource !== 'all') {
      result = result.filter((d) => d.source === filterSource);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.source.toLowerCase().includes(q) ||
          (d.metadata?.section || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'title') {
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
      } else if (sortBy === 'source') {
        aVal = a.source.toLowerCase();
        bVal = b.source.toLowerCase();
      } else {
        // createdAt
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [documents, filterSource, searchQuery, sortBy, sortOrder]);

  const handleUpload = async (file) => {
    if (!file || !masterToken) return;

    setUploading(true);
    setUploadProgress(0);
    clearError();
    clearSuccess();

    const formData = new FormData();
    formData.append('file', file);

    await new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/v1/brain/knowledge-base/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${masterToken}`);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };

      xhr.onload = async () => {
        try {
          const contentType = xhr.getResponseHeader('content-type') || '';
          let data = null;

          if (contentType.includes('application/json')) {
            data = JSON.parse(xhr.responseText || '{}');
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            const created = data?.documentsCreated || 0;
            const storage = data?.file?.storage ? ` · stored: ${data.file.storage}` : '';
            setSuccess(`Uploaded ${file.name} (${created} KB document chunks${storage})`);
            await fetchDocuments();
          } else {
            const fallbackText = (xhr.responseText || '').slice(0, 180).trim();
            const details = data?.details ? ` (${data.details})` : '';
            const msg = data?.error || `Upload failed (HTTP ${xhr.status})`;
            setError(fallbackText && !data ? `${msg}: ${fallbackText}` : msg + details);
          }
        } catch {
          const fallbackText = (xhr.responseText || '').slice(0, 180).trim();
          setError(fallbackText ? `Upload failed: ${fallbackText}` : 'Upload failed: server returned unreadable response');
        } finally {
          setUploading(false);
          setUploadProgress(0);
          resolve();
        }
      };

      xhr.onerror = () => {
        setError('Upload failed due to network error');
        setUploading(false);
        setUploadProgress(0);
        resolve();
      };

      xhr.send(formData);
    });
  };

  const handleDelete = (docId) => {
    openDeleteConfirmation(docId);
  };

  const handleOpenDocument = async (doc) => {
    try {
      const response = await fetch(`/api/v1/brain/knowledge-base/${doc.id}`, {
        headers: { Authorization: `Bearer ${masterToken}` },
      });

      if (!response.ok) {
        openEditor(doc);
        return;
      }

      const payload = await response.json();
      const fullDoc = payload?.data || doc;
      openEditor({
        ...doc,
        ...fullDoc,
        content: fullDoc.content || doc.content || '',
      });
    } catch {
      openEditor(doc);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Knowledge Base</h1>
          <p className="mt-1 text-slate-400">
            Manage documents that inform AI context and memory
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-60">
            <span>⬆</span>
            Upload File
            <input
              type="file"
              accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <span>+</span>
            New Document
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg bg-red-900 bg-opacity-30 border border-red-700 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-lg">✕</span>
            <p className="text-sm text-red-200">{error}</p>
          </div>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 text-sm flex-shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-900 bg-opacity-30 border border-green-700 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-lg">✓</span>
            <p className="text-sm text-green-200">{success}</p>
          </div>
          <button onClick={clearSuccess} className="text-green-400 hover:text-green-300 text-sm flex-shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {uploading && (
        <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
          <div className="flex items-center justify-between text-sm text-slate-300 mb-2">
            <span>Uploading document…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Stats bar */}
      {!isLoading && documents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Documents', value: stats.total, icon: '📄' },
            { label: 'Sources', value: stats.sources, icon: '🗂️' },
            { label: 'Total Words', value: stats.words.toLocaleString(), icon: '📝' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center"
            >
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-slate-400">Loading knowledge base...</p>
          </div>
        </div>
      )}

      {/* Controls: search, sort, filter, view toggle */}
      {!isLoading && documents.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="flex-1 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 outline-none text-sm"
          />

          {/* Source filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white focus:border-blue-500 outline-none text-sm"
          >
            <option value="all">All Sources</option>
            {uniqueSources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={`${sortBy}_${sortOrder}`}
            onChange={(e) => {
              const [by, order] = e.target.value.split('_');
              setSortBy(by);
              setSortOrder(order);
            }}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white focus:border-blue-500 outline-none text-sm"
          >
            <option value="createdAt_desc">Newest first</option>
            <option value="createdAt_asc">Oldest first</option>
            <option value="title_asc">Title A–Z</option>
            <option value="title_desc">Title Z–A</option>
            <option value="source_asc">Source A–Z</option>
          </select>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⊞
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ☰
            </button>
          </div>
        </div>
      )}

      {/* Documents */}
      {!isLoading && displayDocuments.length > 0 && (
        <div>
          <p className="text-sm text-slate-500 mb-3">
            Showing {displayDocuments.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
          </p>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayDocuments.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} onEdit={() => handleOpenDocument(doc)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* List header */}
              <div className="hidden lg:flex items-center gap-4 px-5 py-2 text-xs text-slate-600 uppercase tracking-wide">
                <span className="flex-1">Title</span>
                <span>Source</span>
                <span className="w-16 text-right">Words</span>
                <span className="w-24 text-right">Created</span>
                <span className="w-8"></span>
              </div>
              {displayDocuments.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} onDelete={handleDelete} onEdit={() => handleOpenDocument(doc)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* No search results */}
      {!isLoading && documents.length > 0 && displayDocuments.length === 0 && (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-10 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-lg font-semibold text-white mb-1">No documents found</h3>
          <p className="text-slate-400 text-sm">
            Try adjusting your search or filter
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterSource('all');
            }}
            className="mt-4 px-4 py-2 text-sm text-blue-400 hover:text-blue-300 border border-blue-700 rounded-lg hover:bg-blue-900 hover:bg-opacity-20 transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && documents.length === 0 && (
        <div className="rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 p-14 text-center">
          <div className="text-6xl mb-4">🧠</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Knowledge Base is empty
          </h3>
          <p className="text-slate-400 mb-6 max-w-sm mx-auto">
            Add documents to help the AI understand your context, preferences, and memory.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <span>+</span>
            Add Your First Document
          </button>
        </div>
      )}

      {/* Modals & Overlays */}
      <CreateDocumentModal />
      <DocumentEditor />
      <DeleteDocumentConfirmation />
    </div>
  );
}

export default KnowledgeBase;
