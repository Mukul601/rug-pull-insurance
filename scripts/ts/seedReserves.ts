#!/usr/bin/env ts-node

import { parseUnits, formatUnits } from 'viem';
import { 
  createClients, 
  getNetworkConfig, 
  loadAddresses, 
  waitForTransaction, 
  logInfo, 
  logSuccess, 
  logError, 
  handleError,
  validateEnvVars,
  parseTokenAmount,
  formatTokenAmount,
  retry
} from './utils';

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
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

// CoverageManager ABI for reserve operations
const COVERAGE_MANAGER_ABI = [
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

interface SeedReservesOptions {
  chainId: number;
  amount: string;
  tokenAddress?: string;
  dryRun?: boolean;
}

async function seedReserves(options: SeedReservesOptions) {
  const { chainId, amount, tokenAddress, dryRun = false } = options;
  
  try {
    // Validate environment variables
    validateEnvVars(['PRIVATE_KEY', `RPC_URL_${chainId}`]);
    
    // Load network configuration
    const networkConfig = getNetworkConfig(chainId as any);
    const targetToken = tokenAddress || networkConfig.paymentToken;
    
    if (!targetToken) {
      throw new Error(`Payment token address not found for chain ${chainId}`);
    }
    
    logInfo(`Seeding reserves for ${networkConfig.name}`, {
      chainId,
      tokenAddress: targetToken,
      amount,
      dryRun
    });
    
    // Create clients
    const { publicClient, walletClient, account } = createClients(chainId as any);
    
    // Get token information
    const [tokenSymbol, tokenDecimals] = await Promise.all([
      publicClient.readContract({
        address: targetToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol'
      }),
      publicClient.readContract({
        address: targetToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals'
      })
    ]);
    
    logInfo(`Token Information`, {
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      address: targetToken
    });
    
    // Parse amount with correct decimals
    const amountWei = parseTokenAmount(amount, tokenDecimals);
    
    // Check current balance
    const currentBalance = await publicClient.readContract({
      address: targetToken as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    
    logInfo(`Current Balance`, {
      balance: formatTokenAmount(currentBalance, tokenDecimals),
      symbol: tokenSymbol
    });
    
    if (currentBalance < amountWei) {
      throw new Error(`Insufficient balance. Required: ${formatTokenAmount(amountWei, tokenDecimals)} ${tokenSymbol}, Available: ${formatTokenAmount(currentBalance, tokenDecimals)} ${tokenSymbol}`);
    }
    
    // Check current contract balance
    const contractBalance = await publicClient.readContract({
      address: networkConfig.coverageManager as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [networkConfig.coverageManager as `0x${string}`]
    });
    
    logInfo(`Current Contract Balance`, {
      balance: formatTokenAmount(contractBalance, tokenDecimals),
      symbol: tokenSymbol
    });
    
    if (dryRun) {
      logSuccess(`Dry run completed. Would transfer ${formatTokenAmount(amountWei, tokenDecimals)} ${tokenSymbol} to CoverageManager`);
      return;
    }
    
    // Transfer tokens to CoverageManager
    logInfo(`Transferring ${formatTokenAmount(amountWei, tokenDecimals)} ${tokenSymbol} to CoverageManager...`);
    
    const transferHash = await retry(async () => {
      return await walletClient.writeContract({
        address: targetToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [networkConfig.coverageManager as `0x${string}`, amountWei]
      });
    });
    
    // Wait for transaction confirmation
    const receipt = await waitForTransaction(publicClient, transferHash);
    
    if (receipt.status !== 'success') {
      throw new Error('Transaction failed');
    }
    
    // Get updated contract balance
    const newContractBalance = await publicClient.readContract({
      address: networkConfig.coverageManager as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [networkConfig.coverageManager as `0x${string}`]
    });
    
    // Get contract stats
    const stats = await publicClient.readContract({
      address: networkConfig.coverageManager as `0x${string}`,
      abi: COVERAGE_MANAGER_ABI,
      functionName: 'getStats'
    });
    
    logSuccess(`Reserves seeded successfully!`, {
      transactionHash: transferHash,
      amountTransferred: formatTokenAmount(amountWei, tokenDecimals),
      symbol: tokenSymbol,
      newContractBalance: formatTokenAmount(newContractBalance, tokenDecimals),
      contractStats: {
        totalPolicies: stats[0].toString(),
        totalCoverage: formatTokenAmount(stats[1], tokenDecimals),
        totalPremiums: formatTokenAmount(stats[2], tokenDecimals),
        totalClaims: stats[3].toString(),
        contractBalance: formatTokenAmount(stats[4], tokenDecimals)
      }
    });
    
  } catch (error) {
    handleError(error, 'seedReserves');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: ts-node seedReserves.ts <chainId> <amount> [tokenAddress] [--dry-run]

Arguments:
  chainId      - Chain ID (1=mainnet, 11155111=sepolia, 137=polygon, 42161=arbitrum, 10=optimism)
  amount       - Amount to transfer (in token units, e.g., "1000.5")
  tokenAddress - Optional token address (defaults to payment token from addresses.json)
  --dry-run    - Optional flag to simulate without executing transaction

Examples:
  ts-node seedReserves.ts 1 "1000000"                    # Transfer 1M tokens to mainnet
  ts-node seedReserves.ts 11155111 "100000" --dry-run    # Dry run on sepolia
  ts-node seedReserves.ts 137 "500000" "0x..."           # Transfer to specific token on polygon
    `);
    process.exit(1);
  }
  
  const chainId = parseInt(args[0]);
  const amount = args[1];
  const tokenAddress = args[2] && !args[2].startsWith('--') ? args[2] : undefined;
  const dryRun = args.includes('--dry-run');
  
  await seedReserves({
    chainId,
    amount,
    tokenAddress,
    dryRun
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(handleError);
}

export { seedReserves };
