import { useState } from 'react';

function DeleteAccountModal({ isOpen, onClose, onConfirm, isDeleting }) {
  const [confirmText, setConfirmText] = useState('');

  const isValid = confirmText === 'DELETE';

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm();
  };

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-red-700 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-900 bg-opacity-50 flex items-center justify-center flex-shrink-0">
            <span className="text-red-400 text-lg">⚠️</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Delete Account</h2>
            <p className="text-sm text-red-400">This action is permanent and cannot be undone</p>
          </div>
        </div>

        {/* Warning box */}
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-200 font-medium mb-2">Deleting your account will:</p>
          <ul className="text-sm text-red-300 space-y-1 list-disc list-inside">
            <li>Permanently delete all your data</li>
            <li>Revoke all API tokens immediately</li>
            <li>Remove all personas and knowledge bases</li>
            <li>Cancel any active sessions</li>
          </ul>
        </div>

        {/* Confirmation input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || isDeleting}
            className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isDeleting ? 'Deleting...' : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteAccountModal;
