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
  general: 'bg-opacity-10 ink-3 border-opacity-20',
  notes: 'bg-yellow-600 bg-opacity-20 text-yellow-300 border-yellow-700',
};

function getSourceColor(source) {
  return SOURCE_COLORS[source] || 'bg-indigo-600 bg-opacity-20 text-indigo-300 border-indigo-700';
}

function SourceBadge({ source }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getSourceColor(source)}`}
    >
      {source}
    </span>
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

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.pdf,text/plain,text/markdown,application/pdf';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    };
    input.click();
  };

  return (
    <div className="space-y-8">
      {/* Section head */}
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">AI BRAIN · KNOWLEDGE</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">Documents agents can reason over.</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Attach documents to specific personas. Everything is markdown-first, encrypted at rest, and versioned.</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button className="btn" onClick={handleImport}>&#x2197; Import</button>
          <button className="btn btn-primary" onClick={openCreateModal}>+ New document</button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded p-4 flex items-center justify-between gap-4" style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', opacity: 0.9 }}>
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--red)' }} className="text-lg">✕</span>
            <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
          </div>
          <button onClick={clearError} className="text-sm flex-shrink-0" style={{ color: 'var(--red)' }}>
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="rounded p-4 flex items-center justify-between gap-4" style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', opacity: 0.9 }}>
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--green)' }} className="text-lg">✓</span>
            <p className="text-sm" style={{ color: 'var(--green)' }}>{success}</p>
          </div>
          <button onClick={clearSuccess} className="text-sm flex-shrink-0" style={{ color: 'var(--green)' }}>
            Dismiss
          </button>
        </div>
      )}

      {uploading && (
        <div className="rounded bg-raised hairline p-4">
          <div className="flex items-center justify-between text-sm ink-2 mb-2">
            <span>Uploading document…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 rounded overflow-hidden bg-sunk">
            <div className="h-full transition-all" style={{ width: `${uploadProgress}%`, background: 'var(--green)' }} />
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div className="flex justify-center h-32 items-center">
          <div className="w-8 h-8 border-2 border-[color:var(--line)] border-t-[color:var(--accent)] rounded-full animate-spin" />
        </div>
      )}

      {/* Search / filter bar */}
      {!isLoading && (
        <div className="flex items-center gap-3 mb-4">
          <input
            className="ui-input"
            style={{ maxWidth: '280px' }}
            placeholder="Search documents…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {uniqueSources.length > 0 && (
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="ui-input text-sm"
              style={{ maxWidth: '180px' }}
            >
              <option value="all">All sources</option>
              {uniqueSources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {documents.length > 0 && (
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('_');
                setSortBy(by);
                setSortOrder(order);
              }}
              className="ui-input text-sm"
              style={{ maxWidth: '160px' }}
            >
              <option value="createdAt_desc">Newest first</option>
              <option value="createdAt_asc">Oldest first</option>
              <option value="title_asc">Title A–Z</option>
              <option value="title_desc">Title Z–A</option>
              <option value="source_asc">Source A–Z</option>
            </select>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <div className="card overflow-hidden">
          {/* Column header */}
          <div className="grid grid-cols-12 px-5 py-2 border-b hairline bg-sunk micro">
            <span className="col-span-5">Title</span>
            <span className="col-span-3">Attached to</span>
            <span className="col-span-2">Size</span>
            <span className="col-span-2 text-right">Updated</span>
          </div>

          {/* Rows */}
          {displayDocuments.map((doc) => {
            const kind = doc.type || doc.source || 'md';
            const kindShort = kind.slice(0, 3).toLowerCase();
            const isPdf = kindShort === 'pdf';
            const wordCount = doc.metadata?.wordCount || doc.word_count || 0;
            const updated = doc.updated_at || doc.createdAt || doc.created_at;

            return (
              <div
                key={doc.id}
                className="grid grid-cols-12 px-5 py-3.5 border-b hairline items-center cursor-pointer group hover:bg-sunk transition-colors"
                onClick={() => handleOpenDocument(doc)}
              >
                {/* col-span-5: type glyph + title + id */}
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <span
                    className={`w-8 h-8 border hairline bg-sunk grid place-items-center mono text-[10px] shrink-0 ${isPdf ? 'accent' : 'ink-3'}`}
                  >
                    {kindShort}
                  </span>
                  <div className="min-w-0">
                    <div className="ink text-[14px] truncate">{doc.title}</div>
                    <div className="mono text-[11.5px] ink-3">{doc.id?.slice(0, 8) || '—'}</div>
                  </div>
                </div>

                {/* col-span-3: persona chips */}
                <div className="col-span-3 flex flex-wrap gap-1">
                  {doc.persona_id || doc.personaId ? (
                    <span style={{ background: 'transparent', color: 'var(--ink-2)', borderColor: 'var(--line)', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', fontSize: '11px', border: '1px solid', borderRadius: '3px' }}>
                      {doc.persona_name || doc.persona_id || 'persona'}
                    </span>
                  ) : (
                    <span className="text-[11.5px] ink-4 italic">unattached</span>
                  )}
                </div>

                {/* col-span-2: size */}
                <div className="col-span-2 mono text-[12px] ink-2">
                  {wordCount > 0 ? `${wordCount.toLocaleString()} words` : doc.size || '—'}
                </div>

                {/* col-span-2: updated + delete on hover */}
                <div className="col-span-2 text-right text-[12.5px] ink-3 flex items-center justify-end gap-2">
                  <span>{updated ? new Date(updated).toLocaleDateString() : '—'}</span>
                  <button
                    className="btn btn-ghost text-[11px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                    title="Delete document"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}

          {/* No search results */}
          {documents.length > 0 && displayDocuments.length === 0 && (
            <div className="px-5 py-12 text-center">
              <div className="ink-3 text-[13px]">No documents match your search.</div>
              <button
                className="btn mt-4"
                onClick={() => { setSearchQuery(''); setFilterSource('all'); }}
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Empty state inside table */}
          {documents.length === 0 && !isLoading && (
            <div className="px-5 py-12 text-center">
              <div className="ink-3 text-[13px]">No documents yet.</div>
              <button className="btn btn-primary mt-4" onClick={openCreateModal}>+ New document</button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateDocumentModal />
      <DocumentEditor />
      <DeleteDocumentConfirmation />
    </div>
  );
}

export default KnowledgeBase;
