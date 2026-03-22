import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    const toast = { id, message, type };
    
    setToasts(prev => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showSuccessToast = useCallback((message, duration = 3000) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const showErrorToast = useCallback((message, duration = 4000) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const showInfoToast = useCallback((message, duration = 3000) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  return { toasts, showToast, removeToast, showSuccessToast, showErrorToast, showInfoToast };
}
