import React from 'react';

function Toast({ message, type = 'info', onClose }) {
  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  }[type] || 'bg-blue-500';

  const icon = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'ℹ',
  }[type] || 'ℹ';

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in`}>
      <span className="font-bold text-lg">{icon}</span>
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-auto text-white/70 hover:text-white transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default Toast;
