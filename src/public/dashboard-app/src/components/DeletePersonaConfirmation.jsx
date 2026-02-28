import { useState } from 'react';
import { usePersonaStore } from '../stores/personaStore';

function DeletePersonaConfirmation({ onConfirm }) {
  const { showDeleteConfirmation, closeDeleteConfirmation, targetPersonaId, personas } =
    usePersonaStore();

  const [confirming, setConfirming] = useState(false);

  const targetPersona = personas.find((p) => p.id === targetPersonaId);

  const handleConfirm = async () => {
    if (!targetPersonaId) return;

    setConfirming(true);

    try {
      const success = await onConfirm(targetPersonaId);
      if (success) {
        closeDeleteConfirmation();
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setConfirming(false);
    }
  };

  if (!showDeleteConfirmation || !targetPersona) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-sm w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-red-700">
          <h2 className="text-lg font-bold text-red-300">⚠️ Delete Persona?</h2>
          <button
            onClick={closeDeleteConfirmation}
            disabled={confirming}
            className="text-slate-400 hover:text-white text-2xl leading-none disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-slate-300">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-white">{targetPersona.name}</span>?
          </p>

          <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3">
            <p className="text-red-200 text-sm font-medium">This action cannot be undone.</p>
            {targetPersona.active && (
              <p className="text-red-200 text-sm mt-2">
                This is your active persona. Deleting it will deactivate it.
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={closeDeleteConfirmation}
              disabled={confirming}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {confirming ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeletePersonaConfirmation;
