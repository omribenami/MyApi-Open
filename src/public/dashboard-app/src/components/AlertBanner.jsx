import React, { useState, useEffect } from 'react';

/**
 * AlertBanner - Professional real-time alert system for dashboard
 * Displays notifications for:
 * - Critical: RED (new device requests, security issues)
 * - Warning: AMBER (rate limits, errors)
 * - Success: GREEN (operational status)
 * Styled like modern enterprise SaaS (Slack, Vercel, AWS)
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

    // Auto-dismiss non-critical alerts after 6 seconds
    if (alert.severity !== 'critical') {
      const timer = setTimeout(() => {
        onDismiss?.(alert.id);
      }, 6000);
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
          container: 'bg-red-950/30 border-l-4 border-red-600 backdrop-blur',
          icon: 'bg-red-500/15 text-red-400',
          iconSvg: 'w-5 h-5',
          title: 'text-red-200',
          message: 'text-red-100/70',
          details: 'text-red-100/50',
          button: 'bg-red-600 hover:bg-red-700 text-white hover:text-white',
          progressBg: 'bg-red-600/30',
          progressFill: 'bg-red-600',
        };
      case 'warning':
        return {
          container: 'bg-amber-950/30 border-l-4 border-amber-600 backdrop-blur',
          icon: 'bg-amber-500/15 text-amber-400',
          iconSvg: 'w-5 h-5',
          title: 'text-amber-200',
          message: 'text-amber-100/70',
          details: 'text-amber-100/50',
          button: 'bg-amber-600 hover:bg-amber-700 text-white hover:text-white',
          progressBg: 'bg-amber-600/30',
          progressFill: 'bg-amber-600',
        };
      default:
        return {
          container: 'bg-green-950/30 border-l-4 border-green-600 backdrop-blur',
          icon: 'bg-green-500/15 text-green-400',
          iconSvg: 'w-5 h-5',
          title: 'text-green-200',
          message: 'text-green-100/70',
          details: 'text-green-100/50',
          button: 'bg-green-600 hover:bg-green-700 text-white hover:text-white',
          progressBg: 'bg-green-600/30',
          progressFill: 'bg-green-600',
        };
    }
  };

  const getIconPath = (severity) => {
    switch (severity) {
      case 'critical':
        // Alert/Error icon
        return "M12 9v2m0 4v2m0 4v2M7.08 6.06A9 9 0 1020.94 19.94M7.08 6.06l-.001.001m0 0A9 9 0 1020.941 19.94m0 0A9 9 0 017.08 6.061z";
      case 'warning':
        // Warning icon
        return "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
      default:
        // Success icon
        return "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z";
    }
  };

  const styles = getSeverityStyles(displayedAlert.severity);

  return (
    <div
      className={`rounded-lg border border-slate-700/30 ${styles.container} p-4 mb-6 shadow-lg`}
      role="alert"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${styles.icon}`}>
          <svg className={styles.iconSvg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getIconPath(displayedAlert.severity)} />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className={`font-semibold ${styles.title} text-base leading-tight`}>
            {displayedAlert.title}
          </h3>
          <p className={`${styles.message} text-sm mt-1`}>
            {displayedAlert.message}
          </p>
          {displayedAlert.details && (
            <p className={`${styles.details} text-xs mt-2`}>
              {displayedAlert.details}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-2 ml-4">
          {displayedAlert.severity === 'critical' && onApprove && (
            <button
              onClick={() => {
                onApprove?.(displayedAlert.deviceId);
                onDismiss?.(displayedAlert.id);
              }}
              className={`${styles.button} px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap`}
            >
              Approve
            </button>
          )}
          <button
            onClick={() => {
              clearTimeout(autoCloseTimer);
              onDismiss?.(displayedAlert.id);
            }}
            className="text-slate-400 hover:text-slate-300 text-lg leading-none transition-colors flex-shrink-0 -mr-1"
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress indicator for auto-dismiss */}
      {displayedAlert.severity !== 'critical' && (
        <div className={`mt-3 h-1 rounded-full overflow-hidden ${styles.progressBg}`}>
          <div
            className={`h-full ${styles.progressFill} animate-shrink`}
            style={{
              animation: 'shrink 6s linear forwards',
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

export default AlertBanner;
