import { useTokenStore } from '../stores/tokenStore';
import { useAuthStore } from '../stores/authStore';

function RevokeConfirmationModal({ isOpen, token, onClose, onConfirm }) {
  const masterToken = useAuthStore((state) => state.masterToken);
  const { revokeToken, isSaving } = useTokenStore();

  const handleConfirm = async () => {
    if (!token) return;

    const success = await revokeToken(masterToken, token.id);

    if (success) {
      onConfirm?.();
      onClose();
    }
  };

  if (!isOpen || !token) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">Revoke Token?</h2>
          <p className="text-sm text-slate-400 mt-1">
            This action cannot be undone.
          </p>
        </div>

        {/* Token Info */}
        <div className="bg-slate-900 rounded-lg p-4 mb-6 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1">Token Name</p>
          <p className="text-white font-medium">{token.label || token.name}</p>

          {token.scopes && token.scopes.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-slate-400 mb-2">Scopes</p>
              <div className="flex flex-wrap gap-2">
                {token.scopes.slice(0, 3).map((scope) => (
                  <span
                    key={scope}
                    className="inline-block bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs"
                  >
                    {scope}
                  </span>
                ))}
                {token.scopes.length > 3 && (
                  <span className="inline-block bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs">
                    +{token.scopes.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 mb-6">
          <p className="text-sm text-red-200">
            Once revoked, this token will no longer work. Any integrations using this token will stop functioning.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Revoking...' : 'Revoke Token'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RevokeConfirmationModal;
