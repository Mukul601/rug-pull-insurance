'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { config } from '@/lib/wagmi';
import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export function NetworkBanner() {
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const [isDismissed, setIsDismissed] = useState(false);
  
  const targetChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111');
  const isWrongNetwork = chain?.id !== targetChainId;

  if (isDismissed || !isWrongNetwork) {
    return null;
  }

  const handleSwitch = async () => {
    try {
      await switchChain({ chainId: targetChainId });
    } catch (error) {
      console.error('Failed to switch chain:', error);
    }
  };

  const getChainName = (chainId: number) => {
    const chainNames: Record<number, string> = {
      1: 'Ethereum Mainnet',
      11155111: 'Sepolia Testnet',
      137: 'Polygon',
      42161: 'Arbitrum One',
      10: 'Optimism',
    };
    return chainNames[chainId] || `Chain ${chainId}`;
  };

  return (
    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Wrong Network
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>
              You're connected to <strong>{getChainName(chain?.id || 0)}</strong>, 
              but this app requires <strong>{getChainName(targetChainId)}</strong>.
            </p>
          </div>
          <div className="mt-3">
            <div className="-mx-2 -my-1.5 flex">
              <button
                onClick={handleSwitch}
                className="bg-red-50 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
              >
                Switch Network
              </button>
              <button
                onClick={() => setIsDismissed(true)}
                className="ml-3 bg-red-50 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={() => setIsDismissed(true)}
              className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
            >
              <span className="sr-only">Dismiss</span>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
