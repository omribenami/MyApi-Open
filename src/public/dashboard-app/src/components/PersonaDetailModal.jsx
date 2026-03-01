import { useState, useEffect } from 'react';
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
      const token = localStorage.getItem('sessionToken');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header with close button */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-8 py-4 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-white">{persona.name}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Persona Preview */}
          <div className="mb-8">
            <PersonaPreview persona={persona} showEditButton={true} onEdit={onEdit} />
          </div>

          {/* Attached Documents Section */}
          {attachedDocuments.length > 0 && (
            <div className="mt-8 pt-8 border-t border-slate-700">
              <h3 className="text-2xl font-bold text-blue-400 pb-2 border-b border-slate-700 mb-4">
                📚 Attached Knowledge Base Documents
              </h3>
              <div className="space-y-2">
                {attachedDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-4 bg-slate-700 rounded-lg">
                    <span className="text-xl">📄</span>
                    <div className="flex-1">
                      <p className="font-medium text-white">{doc.title}</p>
                      <p className="text-xs text-slate-400">{doc.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 pt-8 border-t border-slate-700 flex gap-3 flex-wrap">
            {!persona.active && (
              <button
                onClick={onSetActive}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                🟢 Set as Active
              </button>
            )}

            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              ✏️ Edit
            </button>

            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors ml-auto"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PersonaDetailModal;
