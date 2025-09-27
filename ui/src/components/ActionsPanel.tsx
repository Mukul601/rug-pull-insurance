'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useAccount } from 'wagmi';
import { addresses, CoverageManagerABI } from '@/lib/contracts';
import { toast } from 'react-hot-toast';

interface Command {
  id: string;
  title: string;
  description: string;
  command: string;
  category: 'oracle' | 'settle' | 'inspect' | 'general';
}

export function ActionsPanel() {
  const [policyId, setPolicyId] = useState('');
  const [isSettling, setIsSettling] = useState(false);
  const [commands, setCommands] = useState<Command[]>([]);
  const [isLoadingCommands, setIsLoadingCommands] = useState(true);
  const { address } = useAccount();
  const { writeContract } = useWriteContract();

  // Fetch commands from API
  useEffect(() => {
    const fetchCommands = async () => {
      try {
        setIsLoadingCommands(true);
        const chainId = '11155111'; // Default to sepolia
        const coverageManager = addresses.coverageManager || '0x...';
        const policyIdParam = policyId || '0x...';
        
        const response = await fetch(
          `/api/commands?chainId=${chainId}&coverageManager=${coverageManager}&policyId=${policyIdParam}`
        );
        const data = await response.json();
        
        if (data.success) {
          setCommands(data.data.commands);
        } else {
          console.error('Failed to fetch commands:', data.error);
        }
      } catch (error) {
        console.error('Error fetching commands:', error);
      } finally {
        setIsLoadingCommands(false);
      }
    };

    fetchCommands();
  }, [policyId]);

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    toast.success('Command copied to clipboard!');
  };

  const handlePushOracleAndCheck = () => {
    // For now, show instructions on how to run the script
    const command = `cd ../script && npm run push 11155111 "0x..." "0x..."`;
    navigator.clipboard.writeText(command);
    toast.success('Command copied to clipboard!');
  };

  const handleSettle = async () => {
    if (!policyId || !addresses.coverageManager) {
      toast.error('Policy ID and contract address required');
      return;
    }

    try {
      setIsSettling(true);
      
      // Convert policyId string to bytes32
      const policyIdBytes = policyId.startsWith('0x') 
        ? policyId as `0x${string}`
        : `0x${policyId}` as `0x${string}`;
      
      await writeContract({
        address: addresses.coverageManager,
        abi: CoverageManagerABI,
        functionName: 'settleClaim',
        args: [policyIdBytes],
      });
      
      toast.success('Settle claim transaction submitted');
    } catch (error) {
      console.error('Settle error:', error);
      toast.error('Failed to settle claim');
    } finally {
      setIsSettling(false);
    }
  };

  if (!address) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
        <div className="text-center py-8 text-gray-500">
          Please connect your wallet to access actions
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
      
      <div className="space-y-6">
        {/* Oracle Commands */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Oracle & Check Commands</h3>
          <p className="text-sm text-gray-600 mb-4">
            Push Pyth price updates and check for claimable policies.
          </p>
          
          {isLoadingCommands ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {commands
                .filter(cmd => cmd.category === 'oracle')
                .map((command) => (
                  <div key={command.id} className="bg-gray-50 p-3 rounded-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{command.title}</h4>
                        <p className="text-xs text-gray-600 mb-2">{command.description}</p>
                        <code className="text-xs text-gray-800 bg-gray-200 px-2 py-1 rounded block">
                          {command.command}
                        </code>
                      </div>
                      <button
                        onClick={() => copyCommand(command.command)}
                        className="ml-3 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                        title="Copy command"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Settle Commands */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Settle Commands</h3>
          <p className="text-sm text-gray-600 mb-4">
            Settle claims for specific policies or all claimable policies.
          </p>
          
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Policy ID (for specific settle commands)
              </label>
              <input
                type="text"
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={handleSettle}
              disabled={isSettling || !policyId}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {isSettling ? 'Settling...' : 'Settle Claim (On-chain)'}
            </button>
          </div>

          {isLoadingCommands ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {commands
                .filter(cmd => cmd.category === 'settle')
                .map((command) => (
                  <div key={command.id} className="bg-gray-50 p-3 rounded-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{command.title}</h4>
                        <p className="text-xs text-gray-600 mb-2">{command.description}</p>
                        <code className="text-xs text-gray-800 bg-gray-200 px-2 py-1 rounded block">
                          {command.command}
                        </code>
                      </div>
                      <button
                        onClick={() => copyCommand(command.command)}
                        className="ml-3 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                        title="Copy command"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Additional Commands */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Additional Commands</h3>
          <p className="text-sm text-gray-600 mb-4">
            Inspect contract state, approve tokens, buy policies, and start the hedge bot.
          </p>
          
          {isLoadingCommands ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {commands
                .filter(cmd => cmd.category === 'inspect' || cmd.category === 'general')
                .map((command) => (
                  <div key={command.id} className="bg-gray-50 p-3 rounded-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{command.title}</h4>
                        <p className="text-xs text-gray-600 mb-2">{command.description}</p>
                        <code className="text-xs text-gray-800 bg-gray-200 px-2 py-1 rounded block">
                          {command.command}
                        </code>
                      </div>
                      <button
                        onClick={() => copyCommand(command.command)}
                        className="ml-3 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                        title="Copy command"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Status</h4>
          <div className="text-sm text-blue-700">
            <p>• Wallet: {address ? 'Connected' : 'Not connected'}</p>
            <p>• Coverage Manager: {addresses.coverageManager ? 'Configured' : 'Not configured'}</p>
            <p>• Premium Token: {addresses.premiumToken ? 'Configured' : 'Not configured'}</p>
            <p>• Pyth Oracle: {addresses.pyth ? 'Configured' : 'Not configured'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
