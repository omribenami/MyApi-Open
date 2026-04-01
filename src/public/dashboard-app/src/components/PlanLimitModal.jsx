import { useNavigate } from 'react-router-dom';
import { usePlanLimitStore } from '../stores/planLimitStore';

export default function PlanLimitModal() {
  const { visible, plan, errorMessage, hide } = usePlanLimitStore();
  const navigate = useNavigate();

  if (!visible) return null;

  const planLabel = plan
    ? plan.charAt(0).toUpperCase() + plan.slice(1)
    : 'Current';

  const handleUpgrade = () => {
    hide();
    navigate('/settings?section=billing');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-60"
        onClick={hide}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-6">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500 bg-opacity-15 border border-yellow-500 border-opacity-30 mx-auto mb-4">
          <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-white text-lg font-semibold text-center mb-1">
          {planLabel} Plan Limit Reached
        </h2>

        {/* Message */}
        <p className="text-gray-400 text-sm text-center mb-6">
          {errorMessage || "You've reached the maximum allowed by your current plan."}
          {' '}Upgrade to unlock more.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleUpgrade}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            Upgrade Plan
          </button>
          <button
            onClick={hide}
            className="w-full py-2 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
