import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePersonaStore } from '../stores/personaStore';

function DocumentsSection({ personaId }) {
  const masterToken = useAuthStore((s) => s.masterToken);
  const [docs, setDocs] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (personaId && masterToken) {
      fetchDocs();
      fetchAllDocs();
    }
  }, [personaId, masterToken]);

  const fetchDocs = async () => {
    try {
      const res = await fetch(`/api/v1/personas/${personaId}/documents`, {
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocs(data.data || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchAllDocs = async () => {
    try {
      const res = await fetch('/api/v1/brain/knowledge-base', {
        headers: { 'Authorization': `Bearer ${masterToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAllDocs(data.data?.documents || data.documents || []);
      }
    } catch (e) { console.error(e); }
  };

  const handleAttach = async (docId) => {
    await fetch(`/api/v1/personas/${personaId}/documents`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${masterToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docId }),
    });
    fetchDocs();
    setShowPicker(false);
  };

  const handleDetach = async (docId) => {
    await fetch(`/api/v1/personas/${personaId}/documents/${docId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${masterToken}` },
    });
    fetchDocs();
  };

  const attachedIds = docs.map(d => d.documentId);
  const available = allDocs.filter(d => !attachedIds.includes(d.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-300">📎 Knowledge Base Documents</h3>
        <button onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-blue-400 hover:text-blue-300">
          {showPicker ? 'Cancel' : '+ Attach Document'}
        </button>
      </div>

      {showPicker && (
        <div className="mb-3 bg-slate-900 border border-slate-700 rounded-lg p-3 max-h-40 overflow-y-auto">
          {available.length === 0 ? (
            <p className="text-xs text-slate-500">No documents available to attach</p>
          ) : (
            available.map(doc => (
              <button key={doc.id} onClick={() => handleAttach(doc.id)}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded flex items-center justify-between">
                <span className="truncate">{doc.title || doc.source}</span>
                <span className="text-blue-400 text-xs flex-shrink-0 ml-2">Attach</span>
              </button>
            ))
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading...</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-slate-500">No documents attached to this persona</p>
      ) : (
        <div className="space-y-1">
          {docs.map(doc => (
            <div key={doc.documentId} className="flex items-center justify-between bg-slate-900 rounded px-3 py-2 border border-slate-700">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">📄</span>
                <span className="text-sm text-slate-300 truncate">{doc.title || doc.source}</span>
              </div>
              <button onClick={() => handleDetach(doc.documentId)}
                className="text-xs text-red-400 hover:text-red-300 flex-shrink-0 ml-2">
                Detach
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonaDetailModal() {
  const { showDetailModal, selectedPersona, closeDetailModal } =
    usePersonaStore();

  if (!showDetailModal || !selectedPersona) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{selectedPersona.emoji || '🤖'}</span>
            <div>
              <h2 className="text-xl font-bold text-white">
                {selectedPersona.name}
              </h2>
              {selectedPersona.active && (
                <span className="inline-block mt-1 px-2 py-1 bg-green-600 text-green-100 text-xs font-medium rounded">
                  ✓ Active
                </span>
              )}
            </div>
          </div>
          <button
            onClick={closeDetailModal}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Vibe */}
          {selectedPersona.vibe && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Vibe / Personality
              </h3>
              <p className="text-white">{selectedPersona.vibe}</p>
            </div>
          )}

          {/* Description */}
          {selectedPersona.description && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Description
              </h3>
              <p className="text-slate-200 whitespace-pre-wrap">
                {selectedPersona.description}
              </p>
            </div>
          )}

          {/* Traits */}
          {selectedPersona.traits && selectedPersona.traits.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Traits & Characteristics
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedPersona.traits.map((trait, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-blue-600 text-blue-100 text-sm rounded-full"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Soul Content */}
          {selectedPersona.soul_content && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">
                Soul Content
              </h3>
              <div className="bg-slate-700 rounded-lg p-4 font-mono text-sm text-slate-200 whitespace-pre-wrap max-h-64 overflow-y-auto border border-slate-600">
                {selectedPersona.soul_content}
              </div>
            </div>
          )}

          {/* Knowledge Base Documents */}
          <div className="border-t border-slate-700 pt-4">
            <DocumentsSection personaId={selectedPersona.id} />
          </div>

          {/* Metadata */}
          <div className="border-t border-slate-700 pt-4 text-sm text-slate-400 space-y-1">
            <p>ID: {selectedPersona.id}</p>
            {selectedPersona.created_at && (
              <p>
                Created: {new Date(selectedPersona.created_at).toLocaleDateString()}
              </p>
            )}
            {selectedPersona.updated_at && (
              <p>
                Updated: {new Date(selectedPersona.updated_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Close button */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <button
              onClick={closeDetailModal}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonaDetailModal;
