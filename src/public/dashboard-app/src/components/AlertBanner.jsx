import React, { useState, useEffect } from 'react';

/**
 * AlertBanner - Real-time alert system for dashboard
 * Displays color-coded alerts for:
 * - Critical: 🔴 RED (new device requests)
 * - Warning: 🟡 YELLOW (rate limits, errors)
 * - Success: 🟢 GREEN (all clear)
 */
function AlertBanner({ alerts = [], onDismiss, onApprove }) {
  const [displayedAlert, setDisplayedAlert] = useState(null);
  const [autoCloseTimer, setAutoCloseTimer] = useState(null);

  useEffect(() => {
    if (!alerts || alerts.length === 0) {
      setDisplayedAlert(null);
      return;
    }

    const alert = alerts[0];
    setDisplayedAlert(alert);

    // Auto-dismiss non-critical alerts after 5 seconds
    if (alert.severity !== 'critical') {
      const timer = setTimeout(() => {
        onDismiss?.(alert.id);
      }, 5000);
      setAutoCloseTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [alerts, onDismiss]);

  if (!displayedAlert) {
    return null;
  }

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-950/50',
          border: 'border-red-700',
          icon: '🔴',
          text: 'text-red-300',
          button: 'bg-red-600 hover:bg-red-700 text-white',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-950/50',
          border: 'border-yellow-700',
          icon: '🟡',
          text: 'text-yellow-300',
          button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        };
      default:
        return {
          bg: 'bg-green-950/50',
          border: 'border-green-700',
          icon: '🟢',
          text: 'text-green-300',
          button: 'bg-green-600 hover:bg-green-700 text-white',
        };
    }
  };

  const styles = getSeverityStyles(displayedAlert.severity);

  return (
    <div
      className={`rounded-md ${styles.bg} border ${styles.border} p-4 mb-6 animate-pulse`}
      role="alert"
    >
      <div className="flex items-start gap-4">
        <div className="text-2xl">{styles.icon}</div>
        <div className="flex-1">
          <h3 className={`font-semibold ${styles.text} text-lg`}>
            {displayedAlert.title}
          </h3>
          <p className={`${styles.text} text-sm mt-1`}>
            {displayedAlert.message}
          </p>
          {displayedAlert.details && (
            <p className={`${styles.text} text-xs mt-2 opacity-75`}>
              {displayedAlert.details}
            </p>
          )}
        </div>
        <div className="flex gap-2 items-start">
          {displayedAlert.severity === 'critical' && onApprove && (
            <button
              onClick={() => {
                onApprove?.(displayedAlert.deviceId);
                onDismiss?.(displayedAlert.id);
              }}
              className={`${styles.button} px-4 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap`}
            >
              Approve
            </button>
          )}
          <button
            onClick={() => onDismiss?.(displayedAlert.id)}
            className="text-slate-400 hover:text-slate-300 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertBanner;
