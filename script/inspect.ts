#!/usr/bin/env ts-node

import { 
  createClients, 
  getNetworkConfig, 
  logInfo, 
  logSuccess, 
  logError, 
  handleError,
  validateEnvVars,
  formatTokenAmount,
  priceIdToBytes32
} from './utils';

// CoverageManager ABI for inspection operations
const COVERAGE_MANAGER_ABI = [
  {
    name: 'poolReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'protocolFees',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'policies',
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
  },
  {
    name: 'supportedTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'supportedPriceIds',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'priceId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }]
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
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
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

interface InspectOptions {
  chainId: number;
  tokenAddress?: string | undefined;
  policyId?: string | undefined;
  showAllTokens?: boolean;
  showAllPolicies?: boolean;
  chain?: 'base' | 'base_sepolia';
}

// Policy status enum
const POLICY_STATUS = {
  0: 'ACTIVE',
  1: 'EXPIRED',
  2: 'CLAIMED',
  3: 'CANCELLED'
} as const;

// Format policy data for display
function formatPolicyData(policy: any, tokenDecimals: number = 6) {
  const startTime = new Date(Number(policy.startTime) * 1000);
  const endTime = new Date(Number(policy.endTime) * 1000);
  const now = new Date();
  const isActive = now >= startTime && now <= endTime && policy.status === 0;
  
  return {
    policyholder: policy.policyholder,
    tokenAddress: policy.tokenAddress,
    coverageAmount: formatTokenAmount(policy.coverageAmount, tokenDecimals),
    premium: formatTokenAmount(policy.premium, tokenDecimals),
    duration: `${Math.floor(Number(policy.duration) / 86400)} days`,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    priceId: policy.priceId,
    status: POLICY_STATUS[policy.status as keyof typeof POLICY_STATUS] || 'UNKNOWN',
    isActive,
    timeRemaining: isActive ? `${Math.floor((endTime.getTime() - now.getTime()) / 86400)} days` : 'N/A'
  };
}

// Create a table for policy display
function createPolicyTable(policyData: any) {
  const table = `
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                POLICY DETAILS                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Policyholder:     ${policyData.policyholder.padEnd(42)} │
│ Token Address:    ${policyData.tokenAddress.padEnd(42)} │
│ Coverage Amount:  ${policyData.coverageAmount.padEnd(42)} │
│ Premium:          ${policyData.premium.padEnd(42)} │
│ Duration:         ${policyData.duration.padEnd(42)} │
│ Start Time:       ${policyData.startTime.padEnd(42)} │
│ End Time:         ${policyData.endTime.padEnd(42)} │
│ Price ID:         ${policyData.priceId.padEnd(42)} │
│ Status:           ${policyData.status.padEnd(42)} │
│ Time Remaining:   ${policyData.timeRemaining.padEnd(42)} │
└─────────────────────────────────────────────────────────────────────────────────┘
  `;
  return table;
}

// Create a table for token information
function createTokenTable(tokenData: any) {
  const table = `
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TOKEN INFORMATION                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Name:             ${tokenData.name.padEnd(42)} │
│ Symbol:           ${tokenData.symbol.padEnd(42)} │
│ Address:          ${tokenData.address.padEnd(42)} │
│ Decimals:         ${tokenData.decimals.toString().padEnd(42)} │
│ Balance:          ${tokenData.balance.padEnd(42)} │
│ Allowance:        ${tokenData.allowance.padEnd(42)} │
│ Pool Reserves:    ${tokenData.poolReserves.padEnd(42)} │
│ Protocol Fees:    ${tokenData.protocolFees.padEnd(42)} │
│ Is Supported:     ${tokenData.isSupported ? 'YES' : 'NO'.padEnd(42)} │
└─────────────────────────────────────────────────────────────────────────────────┘
  `;
  return table;
}

// Create a table for contract stats
function createStatsTable(stats: any) {
  const table = `
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            CONTRACT STATISTICS                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Total Policies:   ${stats.totalPolicies.padEnd(42)} │
│ Total Coverage:   ${stats.totalCoverage.padEnd(42)} │
│ Total Premiums:   ${stats.totalPremiums.padEnd(42)} │
│ Total Claims:     ${stats.totalClaims.padEnd(42)} │
│ Contract Balance: ${stats.contractBalance.padEnd(42)} │
└─────────────────────────────────────────────────────────────────────────────────┘
  `;
  return table;
}

async function inspect(options: InspectOptions) {
  const { chainId, tokenAddress, policyId, showAllTokens = false, showAllPolicies = false, chain } = options;
  
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
    
    logInfo(`Inspecting CoverageManager on ${networkConfig.name}`, {
      chainId,
      coverageManager: networkConfig.coverageManager,
      paymentToken: networkConfig.paymentToken,
      tokenAddress,
      policyId
    });
    
    // Create clients with custom RPC URL
    const { publicClient, account } = createClients(chainId as any, rpcUrl);
    
    // Get contract stats
    logInfo(`Fetching contract statistics...`);
    const stats = await publicClient.readContract({
      address: networkConfig.coverageManager as `0x${string}`,
      abi: COVERAGE_MANAGER_ABI,
      functionName: 'getStats'
    });
    
    // Get payment token information
    const paymentTokenInfo = await Promise.all([
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
    
    // Get payment token balances and allowances
    const [paymentTokenBalance, paymentTokenAllowance, poolReserves, protocolFees, isPaymentTokenSupported] = await Promise.all([
      publicClient.readContract({
        address: networkConfig.paymentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address]
      }),
      publicClient.readContract({
        address: networkConfig.paymentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, networkConfig.coverageManager as `0x${string}`]
      }),
      publicClient.readContract({
        address: networkConfig.coverageManager as `0x${string}`,
        abi: COVERAGE_MANAGER_ABI,
        functionName: 'poolReserves',
        args: [networkConfig.paymentToken as `0x${string}`]
      }),
      publicClient.readContract({
        address: networkConfig.coverageManager as `0x${string}`,
        abi: COVERAGE_MANAGER_ABI,
        functionName: 'protocolFees',
        args: [networkConfig.paymentToken as `0x${string}`]
      }),
      publicClient.readContract({
        address: networkConfig.coverageManager as `0x${string}`,
        abi: COVERAGE_MANAGER_ABI,
        functionName: 'supportedTokens',
        args: [networkConfig.paymentToken as `0x${string}`]
      })
    ]);
    
    // Display contract stats
    const statsData = {
      totalPolicies: stats[0].toString(),
      totalCoverage: formatTokenAmount(stats[1], paymentTokenInfo[2]),
      totalPremiums: formatTokenAmount(stats[2], paymentTokenInfo[2]),
      totalClaims: stats[3].toString(),
      contractBalance: formatTokenAmount(stats[4], paymentTokenInfo[2])
    };
    
    console.log(createStatsTable(statsData));
    
    // Display payment token information
    const paymentTokenData = {
      name: paymentTokenInfo[0],
      symbol: paymentTokenInfo[1],
      address: networkConfig.paymentToken,
      decimals: paymentTokenInfo[2],
      balance: formatTokenAmount(paymentTokenBalance, paymentTokenInfo[2]),
      allowance: formatTokenAmount(paymentTokenAllowance, paymentTokenInfo[2]),
      poolReserves: formatTokenAmount(poolReserves, paymentTokenInfo[2]),
      protocolFees: formatTokenAmount(protocolFees, paymentTokenInfo[2]),
      isSupported: isPaymentTokenSupported
    };
    
    console.log(createTokenTable(paymentTokenData));
    
    // If specific token address provided, inspect that token
    if (tokenAddress) {
      logInfo(`Inspecting token: ${tokenAddress}`);
      
      try {
        const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'name'
          }),
          publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'symbol'
          }),
          publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'decimals'
          })
        ]);
        
        const [tokenBalance, tokenAllowance, tokenPoolReserves, tokenProtocolFees, isTokenSupported] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [account.address]
          }),
          publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [account.address, networkConfig.coverageManager as `0x${string}`]
          }),
          publicClient.readContract({
            address: networkConfig.coverageManager as `0x${string}`,
            abi: COVERAGE_MANAGER_ABI,
            functionName: 'poolReserves',
            args: [tokenAddress as `0x${string}`]
          }),
          publicClient.readContract({
            address: networkConfig.coverageManager as `0x${string}`,
            abi: COVERAGE_MANAGER_ABI,
            functionName: 'protocolFees',
            args: [tokenAddress as `0x${string}`]
          }),
          publicClient.readContract({
            address: networkConfig.coverageManager as `0x${string}`,
            abi: COVERAGE_MANAGER_ABI,
            functionName: 'supportedTokens',
            args: [tokenAddress as `0x${string}`]
          })
        ]);
        
        const tokenData = {
          name: tokenName,
          symbol: tokenSymbol,
          address: tokenAddress,
          decimals: tokenDecimals,
          balance: formatTokenAmount(tokenBalance, tokenDecimals),
          allowance: formatTokenAmount(tokenAllowance, tokenDecimals),
          poolReserves: formatTokenAmount(tokenPoolReserves, tokenDecimals),
          protocolFees: formatTokenAmount(tokenProtocolFees, tokenDecimals),
          isSupported: isTokenSupported
        };
        
        console.log(createTokenTable(tokenData));
        
      } catch (error) {
        logError(`Failed to inspect token ${tokenAddress}`, error);
      }
    }
    
    // If specific policy ID provided, inspect that policy
    if (policyId) {
      logInfo(`Inspecting policy: ${policyId}`);
      
      try {
        const policy = await publicClient.readContract({
          address: networkConfig.coverageManager as `0x${string}`,
          abi: COVERAGE_MANAGER_ABI,
          functionName: 'policies',
          args: [policyId as `0x${string}`]
        });
        
        // Get token decimals for the policy's token
        const tokenDecimals = await publicClient.readContract({
          address: policy.tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'decimals'
        });
        
        const policyData = formatPolicyData(policy, tokenDecimals);
        console.log(createPolicyTable(policyData));
        
      } catch (error) {
        logError(`Failed to inspect policy ${policyId}`, error);
      }
    }
    
    // Show all supported tokens if requested
    if (showAllTokens) {
      logInfo(`Fetching all supported tokens...`);
      
      // This would require iterating through all possible tokens
      // For now, we'll show the payment token and any provided token
      console.log('\n📋 Supported Tokens:');
      console.log(`✅ ${paymentTokenInfo[1]} (${networkConfig.paymentToken}) - ${isPaymentTokenSupported ? 'Supported' : 'Not Supported'}`);
      
      if (tokenAddress && tokenAddress !== networkConfig.paymentToken) {
        try {
          const tokenSymbol = await publicClient.readContract({
            address: tokenAddress as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'symbol'
          });
          const isSupported = await publicClient.readContract({
            address: networkConfig.coverageManager as `0x${string}`,
            abi: COVERAGE_MANAGER_ABI,
            functionName: 'supportedTokens',
            args: [tokenAddress as `0x${string}`]
          });
          console.log(`✅ ${tokenSymbol} (${tokenAddress}) - ${isSupported ? 'Supported' : 'Not Supported'}`);
        } catch (error) {
          console.log(`❌ ${tokenAddress} - Error fetching info`);
        }
      }
    }
    
    // Show all supported price IDs if requested
    if (showAllPolicies) {
      logInfo(`Fetching all supported price IDs...`);
      
      console.log('\n📋 Supported Price IDs:');
      for (const [name, priceId] of Object.entries(networkConfig.priceIds)) {
        try {
          const isSupported = await publicClient.readContract({
            address: networkConfig.coverageManager as `0x${string}`,
            abi: COVERAGE_MANAGER_ABI,
            functionName: 'supportedPriceIds',
            args: [priceIdToBytes32(priceId)]
          });
          console.log(`✅ ${name}: ${priceId} - ${isSupported ? 'Supported' : 'Not Supported'}`);
        } catch (error) {
          console.log(`❌ ${name}: ${priceId} - Error checking support`);
        }
      }
    }
    
    logSuccess(`Inspection completed successfully!`, {
      network: networkConfig.name,
      coverageManager: networkConfig.coverageManager,
      paymentToken: networkConfig.paymentToken
    });
    
  } catch (error) {
    handleError(error, 'inspect');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(`
Usage: ts-node inspect.ts <chainId> [options]

Arguments:
  chainId      - Chain ID (8453=base, 84532=base_sepolia)

Options:
  --chain <chain>          - Override chain selection (base or base_sepolia)
  --token <address>        - Inspect specific token
  --policy <policyId>      - Inspect specific policy
  --show-all-tokens        - Show all supported tokens
  --show-all-policies      - Show all supported price IDs

Examples:
  ts-node inspect.ts 84532                                # Basic inspection on base_sepolia
  ts-node inspect.ts 84532 --token 0x...                  # Inspect specific token on base_sepolia
  ts-node inspect.ts 84532 --policy 0x...                 # Inspect specific policy on base_sepolia
  ts-node inspect.ts 8453 --chain base --show-all-tokens  # Show all supported tokens on base
  ts-node inspect.ts 84532 --show-all-policies            # Show all supported price IDs on base_sepolia
  ts-node inspect.ts 84532 --token 0x... --policy 0x...   # Inspect both token and policy on base_sepolia
    `);
    process.exit(1);
  }
  
  const chainId = parseInt(args[0] || '0');
  
  if (chainId === 0) {
    console.error('❌ Chain ID is required');
    process.exit(1);
  }
  
  // Parse options
  const tokenIndex = args.indexOf('--token');
  const tokenAddress = tokenIndex !== -1 ? args[tokenIndex + 1] : undefined;
  
  const policyIndex = args.indexOf('--policy');
  const policyId = policyIndex !== -1 ? args[policyIndex + 1] : undefined;
  
  const chainIndex = args.indexOf('--chain');
  const chain = chainIndex !== -1 && args[chainIndex + 1] ? args[chainIndex + 1] as 'base' | 'base_sepolia' : undefined;
  
  const showAllTokens = args.includes('--show-all-tokens');
  const showAllPolicies = args.includes('--show-all-policies');
  
  await inspect({
    chainId,
    tokenAddress,
    policyId,
    showAllTokens,
    showAllPolicies,
    chain
  });
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => handleError(error, 'main'));
}

export { inspect };
