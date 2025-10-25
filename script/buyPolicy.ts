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
  formatTokenAmount,
  getExplorerUrl,
  waitForTransaction,
  priceIdToBytes32
} from './utils';

// CoverageManager ABI for policy operations
const COVERAGE_MANAGER_ABI = [
  {
    name: 'buyPolicy',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'coverageAmount', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'priceId', type: 'bytes32' }
    ],
    outputs: [{ name: 'policyId', type: 'bytes32' }]
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
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  }
] as const;

interface BuyPolicyOptions {
  chainId: number;
  insuredToken: string;
  premiumAmount: string;
  coveragePctBps: number;
  durationSecs: number;
  priceId: string;
  dryRun?: boolean;
  chain?: 'base' | 'base_sepolia';
}

// Policy status enum (for reference)
// const POLICY_STATUS = {
//   ACTIVE: 0,
//   EXPIRED: 1,
//   CLAIMED: 2,
//   CANCELLED: 3
// } as const;

async function buyPolicy(options: BuyPolicyOptions) {
  const { chainId, insuredToken, premiumAmount, coveragePctBps, durationSecs, priceId, dryRun = false, chain } = options;
  
  try {
    // Determine chain and RPC URL
    let targetChain: 'base' | 'base_sepolia';
    let rpcUrl: string;
    
    if (chain) {
      targetChain = chain;
      rpcUrl = chain === 'base_sepolia' 
        ? (process.env['BASE_SEPOLIA_RPC_URL'] || '')
        : (process.env['BASE_RPC_URL'] || '');
    } else {
      // Auto-detect based on chain ID
      if (chainId === 84532) {
        targetChain = 'base_sepolia';
        rpcUrl = process.env['BASE_SEPOLIA_RPC_URL'] || '';
      } else if (chainId === 8453) {
        targetChain = 'base';
        rpcUrl = process.env['BASE_RPC_URL'] || '';
      } else {
        throw new Error(`Unsupported chain ID: ${chainId}. Only Base networks (8453, 84532) are supported.`);
      }
    }
    
    // Validate environment variables
    validateEnvVars(['PRIVATE_KEY']);
    if (!rpcUrl) {
      throw new Error(`RPC URL not found for ${targetChain}. Please set ${targetChain === 'base_sepolia' ? 'BASE_SEPOLIA_RPC_URL' : 'BASE_RPC_URL'}`);
    }
    
    // Load network configuration with fallback to addresses.json
    const networkConfig = getNetworkConfig(chainId as any);
    
    if (!networkConfig.coverageManager) {
      throw new Error(`CoverageManager address not set for chain ${chainId}`);
    }
    
    if (!networkConfig.paymentToken) {
      throw new Error(`Payment token address not set for chain ${chainId}`);
    }
    
    logInfo(`Buying policy for ${networkConfig.name}`, {
      chainId,
      insuredToken,
      premiumAmount,
      coveragePctBps,
      durationSecs,
      priceId,
      coverageManager: networkConfig.coverageManager,
      paymentToken: networkConfig.paymentToken,
      dryRun
    });
    
    // Create clients with custom RPC URL
    const { publicClient, walletClient, account } = createClients(chainId as any, rpcUrl);
    
    // Get payment token information
    const [paymentTokenName, paymentTokenSymbol, paymentTokenDecimals] = await Promise.all([
      publicClient.readContract({
        address: networkConfig.paymentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name'
      }),
      publicClient.readContract({
        address: networkConfig.paymentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }),
      publicClient.readContract({
        address: networkConfig.paymentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals'
      })
    ]);
    
    logInfo(`Payment Token Information`, {
      name: paymentTokenName,
      symbol: paymentTokenSymbol,
      decimals: paymentTokenDecimals,
      address: networkConfig.paymentToken
    });
    
    // Get insured token information
    const [insuredTokenName, insuredTokenSymbol, insuredTokenDecimals] = await Promise.all([
      publicClient.readContract({
        address: insuredToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name'
      }),
      publicClient.readContract({
        address: insuredToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }),
      publicClient.readContract({
        address: insuredToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals'
      })
    ]);
    
    logInfo(`Insured Token Information`, {
      name: insuredTokenName,
      symbol: insuredTokenSymbol,
      decimals: insuredTokenDecimals,
      address: insuredToken
    });
    
    // Parse premium amount with correct decimals
    const premiumAmountWei = parseTokenAmount(premiumAmount, paymentTokenDecimals);
    
    // Calculate coverage amount based on percentage
    const coverageAmountWei = (premiumAmountWei * BigInt(coveragePctBps)) / BigInt(10000);
    
    logInfo(`Policy Details`, {
      premiumAmount: formatTokenAmount(premiumAmountWei, paymentTokenDecimals),
      premiumSymbol: paymentTokenSymbol,
      coverageAmount: formatTokenAmount(coverageAmountWei, insuredTokenDecimals),
      coverageSymbol: insuredTokenSymbol,
      coveragePercentage: `${coveragePctBps / 100}%`,
      duration: `${durationSecs} seconds (${Math.floor(durationSecs / 86400)} days)`,
      priceId: priceId
    });
    
    // Check payment token balance
    const paymentTokenBalance = await publicClient.readContract({
      address: networkConfig.paymentToken as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    
    logInfo(`Payment Token Balance`, {
      balance: formatTokenAmount(paymentTokenBalance, paymentTokenDecimals),
      symbol: paymentTokenSymbol
    });
    
    if (!dryRun && paymentTokenBalance < premiumAmountWei) {
      throw new Error(`Insufficient payment token balance. Required: ${formatTokenAmount(premiumAmountWei, paymentTokenDecimals)} ${paymentTokenSymbol}, Available: ${formatTokenAmount(paymentTokenBalance, paymentTokenDecimals)} ${paymentTokenSymbol}`);
    }
    
    // Check insured token balance
    const insuredTokenBalance = await publicClient.readContract({
      address: insuredToken as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    
    logInfo(`Insured Token Balance`, {
      balance: formatTokenAmount(insuredTokenBalance, insuredTokenDecimals),
      symbol: insuredTokenSymbol
    });
    
    if (!dryRun && insuredTokenBalance < coverageAmountWei) {
      throw new Error(`Insufficient insured token balance. Required: ${formatTokenAmount(coverageAmountWei, insuredTokenDecimals)} ${insuredTokenSymbol}, Available: ${formatTokenAmount(insuredTokenBalance, insuredTokenDecimals)} ${insuredTokenSymbol}`);
    }
    
    // Convert price ID to bytes32
    const priceIdBytes32 = priceIdToBytes32(priceId);
    
    if (dryRun) {
      logSuccess(`Dry run completed. Would buy policy with premium ${formatTokenAmount(premiumAmountWei, paymentTokenDecimals)} ${paymentTokenSymbol} and coverage ${formatTokenAmount(coverageAmountWei, insuredTokenDecimals)} ${insuredTokenSymbol}`);
      return;
    }
    
    // Buy policy
    logInfo(`Buying policy...`);
    
    const buyPolicyHash = await retry(async () => {
      return await walletClient.writeContract({
        address: networkConfig.coverageManager as `0x${string}`,
        abi: COVERAGE_MANAGER_ABI,
        functionName: 'buyPolicy',
        args: [
          insuredToken as `0x${string}`,
          coverageAmountWei,
          BigInt(durationSecs),
          priceIdBytes32
        ]
      });
    });
    
    // Wait for transaction confirmation
    const receipt = await waitForTransaction(publicClient, buyPolicyHash);
    
    if (receipt.status !== 'success') {
      throw new Error('Buy policy transaction failed');
    }
    
    // Extract policy ID from logs
    let policyId: string | null = null;
    
    if (receipt.logs && receipt.logs.length > 0) {
      // Look for PolicyCreated event in logs
      for (const log of receipt.logs) {
        try {
          // Decode the log to find policy ID
          // This is a simplified approach - in practice, you'd decode the event properly
          if (log.data && log.data.length === 66) { // 0x + 64 hex chars
            policyId = log.data;
            break;
          }
        } catch (error) {
          // Continue searching
        }
      }
    }
    
    // If we couldn't extract from logs, try to get the latest policy
    if (!policyId) {
      try {
        // This is a fallback - in practice, you'd need to implement a way to get the latest policy ID
        logInfo(`Could not extract policy ID from logs, using transaction hash as reference`);
        policyId = buyPolicyHash;
      } catch (error) {
        logError(`Could not determine policy ID`, error);
      }
    }
    
    // Get updated contract stats
    const stats = await publicClient.readContract({
      address: networkConfig.coverageManager as `0x${string}`,
      abi: COVERAGE_MANAGER_ABI,
      functionName: 'getStats'
    });
    
    // Get explorer URL
    const explorerUrl = getExplorerUrl(chainId, buyPolicyHash);
    
    logSuccess(`Policy purchased successfully!`, {
      transactionHash: buyPolicyHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
      policyId: policyId || 'Unknown',
      premiumAmount: formatTokenAmount(premiumAmountWei, paymentTokenDecimals),
      premiumSymbol: paymentTokenSymbol,
      coverageAmount: formatTokenAmount(coverageAmountWei, insuredTokenDecimals),
      coverageSymbol: insuredTokenSymbol,
      duration: `${Math.floor(durationSecs / 86400)} days`,
      priceId: priceId,
      explorerUrl
    });
    
    console.log(`\n🔗 View on Explorer: ${explorerUrl}`);
    console.log(`📋 Policy ID: ${policyId || 'Unknown'}`);
    
    // Log contract stats
    logInfo(`Updated Contract Stats`, {
      totalPolicies: stats[0].toString(),
      totalCoverage: formatTokenAmount(stats[1], paymentTokenDecimals),
      totalPremiums: formatTokenAmount(stats[2], paymentTokenDecimals),
      totalClaims: stats[3].toString(),
      contractBalance: formatTokenAmount(stats[4], paymentTokenDecimals)
    });
    
    return {
      transactionHash: buyPolicyHash,
      policyId: policyId || 'Unknown',
      premiumAmount: premiumAmountWei,
      coverageAmount: coverageAmountWei,
      explorerUrl
    };
    
  } catch (error) {
    handleError(error, 'buyPolicy');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 5) {
    console.log(`
Usage: ts-node buyPolicy.ts <chainId> <insuredToken> <premiumAmount> <coveragePctBps> <durationSecs> <priceId> [options]

Arguments:
  chainId          - Chain ID (8453=base, 84532=base_sepolia)
  insuredToken     - Address of token to insure
  premiumAmount    - Premium amount in payment token units
  coveragePctBps   - Coverage percentage in basis points (e.g., 10000 = 100%)
  durationSecs     - Policy duration in seconds
  priceId          - Pyth price ID for the insured token

Options:
  --chain <chain>  - Override chain selection (base or base_sepolia)
  --dry-run        - Simulate without executing transaction

Examples:
  ts-node buyPolicy.ts 84532 "0xA0b86a33E6441b8c4C8C0e4A0e4A0e4A0e4A0e4A0" "100" 10000 2592000 "ETH_USD"
  ts-node buyPolicy.ts 84532 "0x..." "50" 5000 86400 "BTC_USD" --dry-run
  ts-node buyPolicy.ts 8453 "0x..." "200" 15000 604800 "ETH_USD" --chain base

Price ID Examples:
  ETH_USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
  BTC_USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
    `);
    process.exit(1);
  }
  
  const chainId = parseInt(args[0] || '0');
  const insuredToken = args[1] || '';
  const premiumAmount = args[2] || '';
  const coveragePctBps = parseInt(args[3] || '0');
  const durationSecs = parseInt(args[4] || '0');
  const priceId = args[5] || '';
  
  // Parse options
  const dryRun = args.includes('--dry-run');
  const chainIndex = args.indexOf('--chain');
  const chain = chainIndex !== -1 && args[chainIndex + 1] ? args[chainIndex + 1] as 'base' | 'base_sepolia' : undefined;
  
  // Validate required arguments
  if (chainId === 0 || !insuredToken || !premiumAmount || coveragePctBps === 0 || durationSecs === 0 || !priceId) {
    console.error('❌ All arguments are required');
    process.exit(1);
  }
  
  // Validate coverage percentage
  if (coveragePctBps < 0 || coveragePctBps > 100000) {
    console.error('❌ Coverage percentage must be between 0 and 100000 basis points (0-1000%)');
    process.exit(1);
  }
  
  // Validate duration
  if (durationSecs <= 0) {
    console.error('❌ Duration must be positive');
    process.exit(1);
  }
  
  await buyPolicy({
    chainId,
    insuredToken,
    premiumAmount,
    coveragePctBps,
    durationSecs,
    priceId,
    dryRun,
    chain
  });
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => handleError(error, 'main'));
}

export { buyPolicy };
