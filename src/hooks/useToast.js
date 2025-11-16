/**
 * @file Toast notifications hook
 * @description Custom hook for showing toast notifications using react-hot-toast
 */

import toast from 'react-hot-toast';

/**
 * Custom hook for toast notifications with app-specific styling
 * @returns {Object} Toast notification functions
 */
export const useToast = () => {
  /**
   * Show success toast
   * @param {string} message - Success message
   */
  const success = (message) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#22c55e',
        color: '#fff',
        fontWeight: '500',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#22c55e',
      },
    });
  };

  /**
   * Show error toast
   * @param {string} message - Error message
   */
  const error = (message) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-center',
      style: {
        background: '#ef4444',
        color: '#fff',
        fontWeight: '500',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#ef4444',
      },
    });
  };

  /**
   * Show info toast
   * @param {string} message - Info message
   */
  const info = (message) => {
    toast(message, {
      duration: 3000,
      position: 'top-center',
      icon: 'ℹ️',
      style: {
        background: '#3b82f6',
        color: '#fff',
        fontWeight: '500',
      },
    });
  };

  /**
   * Show warning toast
   * @param {string} message - Warning message
   */
  const warning = (message) => {
    toast(message, {
      duration: 3500,
      position: 'top-center',
      icon: '⚠️',
      style: {
        background: '#f59e0b',
        color: '#fff',
        fontWeight: '500',
      },
    });
  };

  /**
   * Show loading toast
   * @param {string} message - Loading message
   * @returns {string} Toast ID for dismissal
   */
  const loading = (message) => {
    return toast.loading(message, {
      position: 'top-center',
      style: {
        background: '#6b7280',
        color: '#fff',
        fontWeight: '500',
      },
    });
  };

  /**
   * Dismiss a toast by ID
   * @param {string} toastId - Toast ID to dismiss
   */
  const dismiss = (toastId) => {
    toast.dismiss(toastId);
  };

  /**
   * Dismiss all toasts
   */
  const dismissAll = () => {
    toast.dismiss();
  };

  return {
    success,
    error,
    info,
    warning,
    loading,
    dismiss,
    dismissAll,
  };
};
