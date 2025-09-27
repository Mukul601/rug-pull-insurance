import { useCallback } from 'react';
import toast from 'react-hot-toast';
import React from 'react';

export interface ToastOptions {
  duration?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  style?: React.CSSProperties;
  className?: string;
}

export function useToast() {
  const showToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'loading' | 'info' = 'info',
    options?: ToastOptions
  ) => {
    const toastOptions = {
      duration: 4000,
      position: 'top-right' as const,
      ...options,
    };

    switch (type) {
      case 'success':
        return toast.success(message, toastOptions);
      case 'error':
        return toast.error(message, toastOptions);
      case 'loading':
        return toast.loading(message, toastOptions);
      case 'info':
      default:
        return toast(message, toastOptions);
    }
  }, []);

  const showTransactionToast = useCallback((
    txHash: string,
    type: 'sent' | 'mined' | 'failed' = 'sent'
  ) => {
    const explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
    
    switch (type) {
      case 'sent':
        return toast.success(
          React.createElement('div', null,
            React.createElement('p', { className: 'font-medium' }, 'Transaction sent!'),
            React.createElement('a', {
              href: explorerUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'text-blue-600 hover:text-blue-800 text-sm underline'
            }, 'View on Etherscan')
          ),
          { duration: 6000 }
        );
      case 'mined':
        return toast.success(
          React.createElement('div', null,
            React.createElement('p', { className: 'font-medium' }, 'Transaction confirmed!'),
            React.createElement('a', {
              href: explorerUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'text-blue-600 hover:text-blue-800 text-sm underline'
            }, 'View on Etherscan')
          ),
          { duration: 6000 }
        );
      case 'failed':
        return toast.error(
          React.createElement('div', null,
            React.createElement('p', { className: 'font-medium' }, 'Transaction failed'),
            React.createElement('a', {
              href: explorerUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'text-blue-600 hover:text-blue-800 text-sm underline'
            }, 'View on Etherscan')
          ),
          { duration: 8000 }
        );
    }
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    toast.dismiss(toastId);
  }, []);

  const dismissAll = useCallback(() => {
    toast.dismiss();
  }, []);

  return {
    showToast,
    showTransactionToast,
    dismissToast,
    dismissAll,
  };
}
