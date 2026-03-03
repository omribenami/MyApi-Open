import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import PersonaPreview from './PersonaPreview';

function PersonaDetailModal({ persona, onClose, onEdit, onSetActive, onDelete }) {
  const [attachedDocuments, setAttachedDocuments] = useState([]);
  const [attachedSkills, setAttachedSkills] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    if (persona?.id) {
      fetchAttachedDocuments();
      fetchAttachedSkills();
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

  const fetchAttachedSkills = async () => {
    try {
      const token = useAuthStore.getState().masterToken;
      const response = await fetch(`/api/v1/personas/${persona.id}/skills`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAttachedSkills(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch skills:', err);
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

          {/* Attached package section */}
          <div className="mt-8 pt-8 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                Attached Knowledge Base Documents
              </h3>

              {loadingDocs ? (
                <p className="text-sm text-slate-500">Loading documents…</p>
              ) : attachedDocuments.length === 0 ? (
                <p className="text-sm text-slate-500">No documents attached to this persona.</p>
              ) : (
                <div className="space-y-3">
                  {attachedDocuments.map((doc) => (
                    <button
                      key={doc.documentId}
                      type="button"
                      onClick={() => setSelectedDoc(doc)}
                      className="w-full text-left flex items-start gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors"
                    >
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
                        {doc.preview && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{doc.preview}</p>}
                        <p className="text-[11px] text-blue-400 mt-2">Click to preview</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                Attached Skills
              </h3>
              {attachedSkills.length === 0 ? (
                <p className="text-sm text-slate-500">No skills attached to this persona.</p>
              ) : (
                <div className="space-y-3">
                  {attachedSkills.map((skill) => (
                    <div key={skill.skillId} className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                      <p className="font-medium text-slate-200">{skill.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{skill.category || 'custom'} {skill.version ? `• v${skill.version}` : ''}</p>
                      {skill.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{skill.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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

      {selectedDoc && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">{selectedDoc.title}</p>
                <p className="text-xs text-slate-500">{selectedDoc.source}</p>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-slate-400 hover:text-slate-200 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono leading-relaxed">
                {selectedDoc.preview || 'No preview available.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonaDetailModal;
