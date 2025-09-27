'use client';

import { useState, useEffect } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { addresses, CoverageManagerABI, ERC20_ABI, createPublicClient } from '@/lib/contracts';
import { formatUnits } from 'viem';

interface ReservesData {
  poolReserves: string;
  protocolFees: string;
  myBalance: string;
  myAllowance: string;
  tokenDecimals: number;
  tokenSymbol: string;
  tokenName: string;
}

export function ReservesCard() {
  const [data, setData] = useState<ReservesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const fetchData = async () => {
    if (!publicClient || !addresses.coverageManager || !addresses.premiumToken) {
      setError('Contract addresses not configured');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        poolReserves,
        protocolFees,
        tokenDecimals,
        tokenSymbol,
        tokenName,
        myBalance,
        myAllowance,
      ] = await Promise.all([
        publicClient.readContract({
          address: addresses.coverageManager as `0x${string}`,
          abi: CoverageManagerABI,
          functionName: 'poolReserves',
          args: [addresses.premiumToken],
        }),
        publicClient.readContract({
          address: addresses.coverageManager as `0x${string}`,
          abi: CoverageManagerABI,
          functionName: 'protocolFees',
          args: [addresses.premiumToken],
        }),
        publicClient.readContract({
          address: addresses.premiumToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }),
        publicClient.readContract({
          address: addresses.premiumToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }),
        publicClient.readContract({
          address: addresses.premiumToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'name',
        }),
        address ? publicClient.readContract({
          address: addresses.premiumToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }) : Promise.resolve(BigInt(0)),
        address ? publicClient.readContract({
          address: addresses.premiumToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, addresses.coverageManager],
        }) : Promise.resolve(BigInt(0)),
      ]);

      setData({
        poolReserves: (poolReserves as bigint).toString(),
        protocolFees: (protocolFees as bigint).toString(),
        myBalance: myBalance.toString(),
        myAllowance: myAllowance.toString(),
        tokenDecimals: Number(tokenDecimals),
        tokenSymbol: tokenSymbol,
        tokenName: tokenName,
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching reserves data:', err);
      setError('Failed to fetch reserves data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [publicClient, address]);

  const formatAmount = (amount: string, decimals: number) => {
    return formatUnits(BigInt(amount), decimals);
  };

  const formatPercentage = (numerator: string, denominator: string) => {
    if (denominator === '0') return '0%';
    const num = BigInt(numerator);
    const den = BigInt(denominator);
    const percentage = (Number(num * BigInt(10000) / den) / 100).toFixed(2);
    return `${percentage}%`;
  };

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Reserves & Balances</h2>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Reserves & Balances</h2>
        <div className="text-red-600 text-center py-8">{error}</div>
        <button
          onClick={fetchData}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Reserves & Balances</h2>
        <div className="text-gray-500 text-center py-8">No data available</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Reserves & Balances</h2>
        <button
          onClick={fetchData}
          className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
        >
          Refresh
        </button>
      </div>

      {lastUpdated && (
        <p className="text-xs text-gray-500 mb-4">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      <div className="space-y-4">
        {/* Token Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Token Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Name:</span>
              <span className="ml-2 font-medium">{data.tokenName}</span>
            </div>
            <div>
              <span className="text-gray-600">Symbol:</span>
              <span className="ml-2 font-medium">{data.tokenSymbol}</span>
            </div>
            <div>
              <span className="text-gray-600">Decimals:</span>
              <span className="ml-2 font-medium">{data.tokenDecimals}</span>
            </div>
            <div>
              <span className="text-gray-600">Address:</span>
              <span className="ml-2 font-mono text-xs">{addresses.premiumToken?.slice(0, 10)}...</span>
            </div>
          </div>
        </div>

        {/* Pool Reserves */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Pool Reserves</h3>
          <div className="text-2xl font-bold text-blue-900">
            {formatAmount(data.poolReserves, data.tokenDecimals)} {data.tokenSymbol}
          </div>
          <p className="text-xs text-blue-700 mt-1">
            Total reserves in the coverage pool
          </p>
        </div>

        {/* Protocol Fees */}
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-900 mb-2">Protocol Fees</h3>
          <div className="text-2xl font-bold text-green-900">
            {formatAmount(data.protocolFees, data.tokenDecimals)} {data.tokenSymbol}
          </div>
          <p className="text-xs text-green-700 mt-1">
            Fees collected by the protocol
          </p>
        </div>

        {/* My Balance & Allowance */}
        {address && (
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-900 mb-2">My Wallet</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-700">Balance:</span>
                <span className="font-medium text-purple-900">
                  {formatAmount(data.myBalance, data.tokenDecimals)} {data.tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-700">Allowance:</span>
                <span className="font-medium text-purple-900">
                  {formatAmount(data.myAllowance, data.tokenDecimals)} {data.tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-700">Allowance %:</span>
                <span className="font-medium text-purple-900">
                  {formatPercentage(data.myAllowance, data.myBalance)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Coverage Ratio */}
        <div className="bg-yellow-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-900 mb-2">Coverage Ratio</h3>
          <div className="text-2xl font-bold text-yellow-900">
            {formatPercentage(data.protocolFees, data.poolReserves)}
          </div>
          <p className="text-xs text-yellow-700 mt-1">
            Protocol fees as percentage of total reserves
          </p>
        </div>
      </div>
    </div>
  );
}
