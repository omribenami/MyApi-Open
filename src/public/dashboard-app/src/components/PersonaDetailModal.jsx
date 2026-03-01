import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import PersonaPreview from './PersonaPreview';

function PersonaDetailModal({ persona, onClose, onEdit, onSetActive, onDelete }) {
  const [attachedDocuments, setAttachedDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (persona?.id) {
      fetchAttachedDocuments();
    }
  }, [persona?.id]);

  const fetchAttachedDocuments = async () => {
    setLoadingDocs(true);
    try {
      const token = useAuthStore.getState().masterToken;
      const response = await fetch(`/api/v1/personas/${persona.id}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAttachedDocuments(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  if (!persona) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header with close button */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-lg font-medium text-slate-200">Persona Details</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 flex-1">
          {/* Persona Preview */}
          <div className="mb-8">
            <PersonaPreview persona={persona} />
          </div>

          {/* Attached Documents Section */}
          {attachedDocuments.length > 0 && (
            <div className="mt-8 pt-8 border-t border-slate-800">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                Attached Knowledge Base Documents
              </h3>
              <div className="space-y-3">
                {attachedDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                    <div className="text-slate-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-200 truncate">{doc.title}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{doc.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-4 sm:px-8 sm:py-5 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            {!persona.active && (
              <button
                onClick={onSetActive}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-md transition-colors border border-slate-700"
              >
                Set as Active
              </button>
            )}

            <button
              onClick={onEdit}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-md transition-colors border border-slate-700"
            >
              Edit
            </button>
          </div>

          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-950/30 hover:bg-red-900/40 text-red-400 text-sm font-medium rounded-md transition-colors border border-red-900/30"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default PersonaDetailModal;
