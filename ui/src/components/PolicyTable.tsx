'use client';

import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { addresses, CoverageManagerABI } from '@/lib/contracts';
import { formatUnits, parseAbiItem } from 'viem';

interface PolicyEvent {
  id: string;
  policyHolder: string;
  tokenAddress: string;
  coverageAmount: string;
  premium: string;
  expiryTime: string;
  blockNumber: bigint;
  transactionHash: string;
}

export function PolicyTable() {
  const [policies, setPolicies] = useState<PolicyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!publicClient || !addresses.coverageManager) return;

    const fetchPolicies = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get the latest PolicyCreated events using parseAbiItem
        const policyCreatedEvent = parseAbiItem('event PolicyCreated(bytes32 indexed policyId, address indexed policyHolder, address indexed tokenAddress, uint256 coverageAmount, uint256 premium, uint256 expiryTime)');
        
        const events = await publicClient.getLogs({
          address: addresses.coverageManager as `0x${string}`,
          event: policyCreatedEvent,
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        // Parse events and sort by block number (newest first)
        const parsedPolicies = events
          .map((event) => {
            return {
              id: event.args.policyId || '',
              policyHolder: event.args.policyHolder || '',
              tokenAddress: event.args.tokenAddress || '',
              coverageAmount: event.args.coverageAmount?.toString() || '0',
              premium: event.args.premium?.toString() || '0',
              expiryTime: event.args.expiryTime?.toString() || '0',
              blockNumber: event.blockNumber || BigInt(0),
              transactionHash: event.transactionHash || '',
            };
          })
          .filter(policy => policy.id && policy.policyHolder && policy.tokenAddress) // Filter out invalid events
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, 50); // Show last 50 policies

        setPolicies(parsedPolicies);
      } catch (err) {
        console.error('Error fetching policies:', err);
        setError('Failed to fetch policies');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicies();

    // Set up real-time event watching
    const unwatch = publicClient.watchContractEvent({
      address: addresses.coverageManager as `0x${string}`,
      abi: CoverageManagerABI,
      eventName: 'PolicyCreated',
      onLogs: (logs) => {
        const newPolicies = logs.map((log: any) => {
          return {
            id: log.args.policyId || '',
            policyHolder: log.args.policyHolder || '',
            tokenAddress: log.args.tokenAddress || '',
            coverageAmount: log.args.coverageAmount?.toString() || '0',
            premium: log.args.premium?.toString() || '0',
            expiryTime: log.args.expiryTime?.toString() || '0',
            blockNumber: log.blockNumber || BigInt(0),
            transactionHash: log.transactionHash || '',
          };
        }).filter(policy => policy.id && policy.policyHolder && policy.tokenAddress);
        
        setPolicies(prev => [...newPolicies, ...prev].slice(0, 50));
      },
    });

    return () => {
      unwatch();
    };
  }, [publicClient]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  const formatAmount = (amount: string, decimals: number = 18) => {
    return formatUnits(BigInt(amount), decimals);
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Policies</h2>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Policies</h2>
        <div className="text-red-600 text-center py-8">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Recent Policies</h2>
        <span className="text-sm text-gray-500">
          {policies.length} policies
        </span>
      </div>

      {policies.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No policies found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Policy ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Buyer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Token
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Premium Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coverage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiry
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TX
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {policies.map((policy, index) => (
                <tr key={policy.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {formatAddress(policy.id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatAddress(policy.policyHolder)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatAddress(policy.tokenAddress)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatAmount(policy.premium)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatAmount(policy.coverageAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTimestamp(policy.expiryTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${policy.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
