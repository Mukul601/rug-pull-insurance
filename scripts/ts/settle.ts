#!/usr/bin/env ts-node

import { 
  createClients, 
  getNetworkConfig, 
  logInfo, 
  logSuccess, 
  logError, 
  handleError,
  validateEnvVars,
  retry,
  parseTokenAmount,
  formatTokenAmount
} from './utils';

// CoverageManager ABI for settlement operations
const COVERAGE_MANAGER_ABI = [
  {
    name: 'settleClaim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'claimId', type: 'bytes32' },
      { name: 'approved', type: 'bool' },
      { name: 'payoutAmount', type: 'uint256' },
      { name: 'reason', type: 'string' }
    ],
    outputs: []
  },
  {
    name: 'getClaim',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'claimId', type: 'bytes32' }],
    outputs: [
      {
        name: 'claim',
        type: 'tuple',
        components: [
          { name: 'policyId', type: 'bytes32' },
          { name: 'claimant', type: 'address' },
          { name: 'reason', type: 'string' },
          { name: 'requestedAmount', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'settledAt', type: 'uint256' },
          { name: 'payoutAmount', type: 'uint256' },
          { name: 'settlementReason', type: 'string' }
        ]
      }
    ]
  },
  {
    name: 'getPolicy',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'policyId', type: 'bytes32' }],
    outputs: [
      {
        name: 'policy',
        type: 'tuple',
        components: [
          { name: 'policyholder', type: 'address' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'coverageAmount', type: 'uint256' },
          { name: 'premium', type: 'uint256' },
          { name: 'duration', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'priceId', type: 'bytes32' },
          { name: 'status', type: 'uint8' }
        ]
      }
    ]
  },
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_totalPolicies', type: 'uint256' },
      { name: '_totalCoverage', type: 'uint256' },
      { name: '_totalPremiums', type: 'uint256' },
      { name: '_totalClaims', type: 'uint256' },
      { name: '_contractBalance', type: 'uint256' }
    ]
  }
] as const;

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  }
] as const;

interface SettleOptions {
  chainId: number;
  claimId: string;
  approved: boolean;
  payoutAmount?: string;
  reason: string;
  dryRun?: boolean;
}

// Claim status enum
const CLAIM_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  SETTLED: 3
} as const;

// Policy status enum
const POLICY_STATUS = {
  ACTIVE: 0,
  EXPIRED: 1,
  CLAIMED: 2,
  CANCELLED: 3
} as const;

async function settleClaim(options: SettleOptions) {
  const { chainId, claimId, approved, payoutAmount, reason, dryRun = false } = options;
  
  try {
    // Validate environment variables
    validateEnvVars(['PRIVATE_KEY', `RPC_URL_${chainId}`]);
    
    // Load network configuration
    const networkConfig = getNetworkConfig(chainId as any);
    
    logInfo(`Settling claim for ${networkConfig.name}`, {
      chainId,
      claimId,
      approved,
      payoutAmount,
      reason,
      dryRun
    });
    
    // Create clients
    const { publicClient, walletClient } = createClients(chainId as any);
    
    // Get claim details
    const claim = await publicClient.readContract({
      address: networkConfig.coverageManager as `0x${string}`,
      abi: COVERAGE_MANAGER_ABI,
      functionName: 'getClaim',
      args: [claimId as `0x${string}`]
    });
    
    logInfo(`Claim details`, {
      policyId: claim.policyId,
      claimant: claim.claimant,
      reason: claim.reason,
      requestedAmount: claim.requestedAmount.toString(),
      status: claim.status,
      createdAt: new Date(Number(claim.createdAt) * 1000).toISOString(),
      settledAt: claim.settledAt > 0 ? new Date(Number(claim.settledAt) * 1000).toISOString() : 'Not settled',
      payoutAmount: claim.payoutAmount.toString(),
      settlementReason: claim.settlementReason
    });
    
    // Check if claim is already settled
    if (claim.status === CLAIM_STATUS.SETTLED) {
      throw new Error('Claim is already settled');
    }
    
    if (claim.status === CLAIM_STATUS.REJECTED) {
      throw new Error('Claim has been rejected and cannot be settled');
    }
    
    // Get policy details
    const policy = await publicClient.readContract({
      address: networkConfig.coverageManager as `0x${string}`,
      abi: COVERAGE_MANAGER_ABI,
      functionName: 'getPolicy',
      args: [claim.policyId]
    });
    
    logInfo(`Policy details`, {
      policyholder: policy.policyholder,
      tokenAddress: policy.tokenAddress,
      coverageAmount: policy.coverageAmount.toString(),
      premium: policy.premium.toString(),
      duration: policy.duration.toString(),
      startTime: new Date(Number(policy.startTime) * 1000).toISOString(),
      endTime: new Date(Number(policy.endTime) * 1000).toISOString(),
      status: policy.status
    });
    
    // Validate payout amount
    let finalPayoutAmount: bigint;
    
    if (approved) {
      if (payoutAmount) {
        // Get token decimals for proper parsing
        const tokenDecimals = await publicClient.readContract({
          address: policy.tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'decimals'
        });
        
        finalPayoutAmount = parseTokenAmount(payoutAmount, tokenDecimals);
        
        // Validate payout amount doesn't exceed coverage amount
        if (finalPayoutAmount > policy.coverageAmount) {
          throw new Error(`Payout amount ${formatTokenAmount(finalPayoutAmount, tokenDecimals)} exceeds coverage amount ${formatTokenAmount(policy.coverageAmount, tokenDecimals)}`);
        }
      } else {
        // Use requested amount if no payout amount specified
        finalPayoutAmount = claim.requestedAmount;
      }
    } else {
      // Rejected claims have 0 payout
      finalPayoutAmount = 0n;
    }
    
    // Check contract balance if approving
    if (approved && finalPayoutAmount > 0) {
      const contractBalance = await publicClient.readContract({
        address: policy.tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [networkConfig.coverageManager as `0x${string}`]
      });
      
      if (contractBalance < finalPayoutAmount) {
        throw new Error(`Insufficient contract balance. Required: ${formatTokenAmount(finalPayoutAmount, 6)}, Available: ${formatTokenAmount(contractBalance, 6)}`);
      }
      
      logInfo(`Contract balance check passed`, {
        required: formatTokenAmount(finalPayoutAmount, 6),
        available: formatTokenAmount(contractBalance, 6)
      });
    }
    
    if (dryRun) {
      logSuccess(`Dry run completed. Would ${approved ? 'approve' : 'reject'} claim with payout ${formatTokenAmount(finalPayoutAmount, 6)}`);
      return;
    }
    
    // Settle the claim
    logInfo(`${approved ? 'Approving' : 'Rejecting'} claim...`);
    
    const settleHash = await retry(async () => {
      return await walletClient.writeContract({
        address: networkConfig.coverageManager as `0x${string}`,
        abi: COVERAGE_MANAGER_ABI,
        functionName: 'settleClaim',
        args: [
          claimId as `0x${string}`,
          approved,
          finalPayoutAmount,
          reason
        ]
      });
    });
    
    // Wait for transaction confirmation
    const receipt = await retry(async () => {
      return await publicClient.waitForTransactionReceipt({
        hash: settleHash,
        confirmations: 1
      });
    });
    
    if (receipt.status !== 'success') {
      throw new Error('Settlement transaction failed');
    }
    
    // Get updated claim details
    const updatedClaim = await publicClient.readContract({
      address: networkConfig.coverageManager as `0x${string}`,
      abi: COVERAGE_MANAGER_ABI,
      functionName: 'getClaim',
      args: [claimId as `0x${string}`]
    });
    
    // Get updated contract stats
    const stats = await publicClient.readContract({
      address: networkConfig.coverageManager as `0x${string}`,
      abi: COVERAGE_MANAGER_ABI,
      functionName: 'getStats'
    });
    
    logSuccess(`Claim settled successfully!`, {
      transactionHash: settleHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
      claimStatus: updatedClaim.status,
      payoutAmount: formatTokenAmount(updatedClaim.payoutAmount, 6),
      settlementReason: updatedClaim.settlementReason,
      settledAt: new Date(Number(updatedClaim.settledAt) * 1000).toISOString(),
      contractStats: {
        totalPolicies: stats[0].toString(),
        totalCoverage: formatTokenAmount(stats[1], 6),
        totalPremiums: formatTokenAmount(stats[2], 6),
        totalClaims: stats[3].toString(),
        contractBalance: formatTokenAmount(stats[4], 6)
      }
    });
    
    return {
      transactionHash: settleHash,
      claimStatus: updatedClaim.status,
      payoutAmount: updatedClaim.payoutAmount,
      settlementReason: updatedClaim.settlementReason
    };
    
  } catch (error) {
    handleError(error, 'settleClaim');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.log(`
Usage: ts-node settle.ts <chainId> <claimId> <approved> <reason> [options]

Arguments:
  chainId      - Chain ID (1=mainnet, 11155111=sepolia, 137=polygon, 42161=arbitrum, 10=optimism)
  claimId      - Claim ID to settle (0x...)
  approved     - Whether to approve (true) or reject (false) the claim
  reason       - Settlement reason

Options:
  --payout-amount <amount>  - Payout amount in token units (required for approvals)
  --dry-run                 - Simulate without executing transaction

Examples:
  ts-node settle.ts 1 "0x123..." true "Rug pull confirmed" --payout-amount "1000"     # Approve claim with payout
  ts-node settle.ts 11155111 "0x456..." false "Insufficient evidence"                 # Reject claim
  ts-node settle.ts 1 "0x789..." true "Partial payout" --payout-amount "500" --dry-run # Dry run approval
    `);
    process.exit(1);
  }
  
  const chainId = parseInt(args[0]);
  const claimId = args[1];
  const approved = args[2].toLowerCase() === 'true';
  const reason = args[3];
  
  // Parse options
  const payoutAmountIndex = args.indexOf('--payout-amount');
  const payoutAmount = payoutAmountIndex !== -1 ? args[payoutAmountIndex + 1] : undefined;
  
  const dryRun = args.includes('--dry-run');
  
  // Validate required options
  if (approved && !payoutAmount) {
    logError('Payout amount is required for claim approvals');
    process.exit(1);
  }
  
  await settleClaim({
    chainId,
    claimId,
    approved,
    payoutAmount,
    reason,
    dryRun
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(handleError);
}

export { settleClaim };
