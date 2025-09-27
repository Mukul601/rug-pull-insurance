'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { addresses, CoverageManagerABI, ERC20_ABI } from '@/lib/contracts';
import { useTokenInfo, safeParseDecimal } from '@/lib/token-utils';
import { useToast } from '@/hooks/useToast';

interface PolicyFormData {
  insuredToken: string;
  premiumAmount: string;
  coveragePctBps: string;
  durationSecs: string;
  priceId: string;
}

export function PolicyForm() {
  const [formData, setFormData] = useState<PolicyFormData>({
    insuredToken: '',
    premiumAmount: '',
    coveragePctBps: '10000', // 100% default
    durationSecs: '2592000', // 30 days default
    priceId: '',
  });
  const [isApproving, setIsApproving] = useState(false);
  const [isBuying, setIsBuying] = useState(false);

  const { writeContract: writeContractApprove } = useWriteContract();
  const { writeContract: writeContractBuy } = useWriteContract();
  const { showToast, showTransactionToast } = useToast();
  
  // Get token info for the premium token
  const { tokenInfo: premiumTokenInfo, isLoading: isLoadingTokenInfo } = useTokenInfo(addresses.premiumToken);

  const handleApprove = async () => {
    if (!addresses.premiumToken || !addresses.coverageManager) {
      showToast('Contract addresses not configured', 'error');
      return;
    }

    if (!premiumTokenInfo) {
      showToast('Token information not loaded', 'error');
      return;
    }

    // Validate and parse the premium amount
    const parseResult = safeParseDecimal(formData.premiumAmount, premiumTokenInfo.decimals);
    if (!parseResult.success) {
      showToast(parseResult.error, 'error');
      return;
    }

    try {
      setIsApproving(true);
      
      writeContractApprove({
        address: addresses.premiumToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [addresses.coverageManager, parseResult.value],
      });
      
      showToast('Approval transaction submitted', 'success');
    } catch (error) {
      console.error('Approval error:', error);
      showToast('Failed to approve tokens', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleBuyPolicy = async () => {
    if (!addresses.coverageManager || !addresses.premiumToken) {
      showToast('Contract addresses not configured', 'error');
      return;
    }

    if (!premiumTokenInfo) {
      showToast('Token information not loaded', 'error');
      return;
    }

    // Validate and parse the premium amount
    const parseResult = safeParseDecimal(formData.premiumAmount, premiumTokenInfo.decimals);
    if (!parseResult.success) {
      showToast(parseResult.error, 'error');
      return;
    }

    // Validate coverage percentage
    const coveragePctBps = BigInt(formData.coveragePctBps);
    if (coveragePctBps <= BigInt(0) || coveragePctBps > BigInt(100000)) {
      showToast('Coverage percentage must be between 0 and 100000 basis points', 'error');
      return;
    }

    // Validate duration
    const durationSecs = BigInt(formData.durationSecs);
    if (durationSecs <= BigInt(0)) {
      showToast('Duration must be positive', 'error');
      return;
    }

    try {
      setIsBuying(true);
      
      // Convert priceId string to bytes32
      const priceIdBytes = formData.priceId.startsWith('0x') 
        ? formData.priceId as `0x${string}`
        : `0x${formData.priceId}` as `0x${string}`;
      
      writeContractBuy({
        address: addresses.coverageManager,
        abi: CoverageManagerABI,
        functionName: 'buyPolicy',
        args: [
          formData.insuredToken as `0x${string}`,
          addresses.premiumToken,
          parseResult.value,
          coveragePctBps,
          durationSecs,
          priceIdBytes,
        ],
      });
      
      showToast('Policy purchase transaction submitted', 'success');
    } catch (error) {
      console.error('Buy policy error:', error);
      showToast('Failed to buy policy', 'error');
    } finally {
      setIsBuying(false);
    }
  };

  const handleInputChange = (field: keyof PolicyFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Buy Insurance Policy</h2>
      
      <div className="space-y-4">
        {/* Insured Token Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Insured Token Address
          </label>
          <input
            type="text"
            value={formData.insuredToken}
            onChange={(e) => handleInputChange('insuredToken', e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Premium Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Premium Amount
          </label>
          <input
            type="number"
            step="0.000001"
            value={formData.premiumAmount}
            onChange={(e) => handleInputChange('premiumAmount', e.target.value)}
            placeholder="100.0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {isLoadingTokenInfo ? (
              'Loading token info...'
            ) : premiumTokenInfo ? (
              `${premiumTokenInfo.name} (${premiumTokenInfo.symbol}) - ${premiumTokenInfo.decimals} decimals`
            ) : (
              'Token info not available'
            )}
          </p>
        </div>

        {/* Coverage Percentage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Coverage Percentage (Basis Points)
          </label>
          <input
            type="number"
            value={formData.coveragePctBps}
            onChange={(e) => handleInputChange('coveragePctBps', e.target.value)}
            placeholder="10000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {Number(formData.coveragePctBps) / 100}% coverage
          </p>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration (Seconds)
          </label>
          <input
            type="number"
            value={formData.durationSecs}
            onChange={(e) => handleInputChange('durationSecs', e.target.value)}
            placeholder="2592000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            {Math.floor(Number(formData.durationSecs) / 86400)} days
          </p>
        </div>

        {/* Price ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pyth Price ID
          </label>
          <input
            type="text"
            value={formData.priceId}
            onChange={(e) => handleInputChange('priceId', e.target.value)}
            placeholder="0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4 pt-4">
          <button
            onClick={handleApprove}
            disabled={isApproving || !formData.premiumAmount || isLoadingTokenInfo}
            className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApproving ? 'Approving...' : 'Approve Tokens'}
          </button>
          
          <button
            onClick={handleBuyPolicy}
            disabled={isBuying || !formData.insuredToken || !formData.premiumAmount || isLoadingTokenInfo}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBuying ? 'Buying Policy...' : 'Buy Policy'}
          </button>
        </div>


      </div>
    </div>
  );
}
