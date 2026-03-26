import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useKnowledgeStore } from '../stores/knowledgeStore';

function DeleteDocumentConfirmation() {
  const masterToken = useAuthStore((state) => state.masterToken);
  const {
    showDeleteConfirmation,
    targetDocumentId,
    documents,
    closeDeleteConfirmation,
    removeDocument,
    setSuccess,
    setError,
  } = useKnowledgeStore();

  const [deleting, setDeleting] = useState(false);
  const [usage, setUsage] = useState({ direct: [], viaSkills: [], total: 0 });

  const targetDocument = documents.find((d) => d.id === targetDocumentId);

  useEffect(() => {
    const loadUsage = async () => {
      if (!showDeleteConfirmation || !targetDocumentId || !masterToken) return;
      try {
        const res = await fetch(`/api/v1/brain/knowledge-base/${targetDocumentId}/attachments`, {
          headers: { Authorization: `Bearer ${masterToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsage(data?.data || { direct: [], viaSkills: [], total: 0 });
        }
      } catch { /* ignored */ }
    };
    loadUsage();
  }, [showDeleteConfirmation, targetDocumentId, masterToken]);

  const handleConfirm = async () => {
    if (!targetDocumentId || !masterToken) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/v1/brain/knowledge-base/${targetDocumentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${masterToken}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete document');
      }

      removeDocument(targetDocumentId);
      setSuccess('Document deleted successfully');
      closeDeleteConfirmation();
    } catch (err) {
      console.error('Delete document error:', err);
      setError(err.message || 'Failed to delete document');
      closeDeleteConfirmation();
    } finally {
      setDeleting(false);
    }
  };

  if (!showDeleteConfirmation || !targetDocument) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-sm w-full mx-4 border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-800">
          <h2 className="text-lg font-bold text-red-300 flex items-center gap-2">
            <span>⚠️</span>
            Delete Document?
          </h2>
          <button
            onClick={closeDeleteConfirmation}
            disabled={deleting}
            className="text-slate-400 hover:text-white text-xl leading-none disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-slate-300">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-white">
              &ldquo;{targetDocument.title}&rdquo;
            </span>
            ?
          </p>

          <div className="bg-slate-700 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Source:</span>
              <span className="text-slate-300">{targetDocument.source}</span>
            </div>
            {targetDocument.metadata?.wordCount && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Words:</span>
                <span className="text-slate-300">{targetDocument.metadata.wordCount}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Created:</span>
              <span className="text-slate-300">
                {new Date(targetDocument.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {usage.total > 0 && (
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3 space-y-1">
              <p className="text-amber-300 text-sm font-semibold">
                ⚠️ This document is attached to {usage.total} persona reference{usage.total !== 1 ? 's' : ''}.
              </p>
              {usage.direct?.slice(0, 3).map((item) => (
                <p key={`d-${item.personaId}`} className="text-amber-200 text-xs">• Persona: {item.personaName}</p>
              ))}
              {usage.viaSkills?.slice(0, 3).map((item) => (
                <p key={`s-${item.personaId}-${item.skillId}`} className="text-amber-200 text-xs">• Persona: {item.personaName} via skill {item.skillName}</p>
              ))}
            </div>
          )}

          <div className="bg-red-900 bg-opacity-30 border border-red-800 rounded-lg p-3">
            <p className="text-red-300 text-sm font-medium">
              ⚠️ This action cannot be undone. The document chunk will be permanently removed from the knowledge base.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={closeDeleteConfirmation}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteDocumentConfirmation;
