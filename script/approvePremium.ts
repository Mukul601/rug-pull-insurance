#!/usr/bin/env ts-node

import { 
  createClients, 
  getNetworkConfig, 
  logInfo, 
  logSuccess, 
  handleError,
  validateEnvVars,
  retry,
  parseTokenAmount,
  formatTokenAmount,
  getExplorerUrl,
  waitForTransaction
} from './utils';

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
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

interface ApprovePremiumOptions {
  chainId: number;
  amount: string;
  dryRun?: boolean;
}

async function approvePremium(options: ApprovePremiumOptions) {
  const { chainId, amount, dryRun = false } = options;
  
  try {
    // Validate environment variables
    validateEnvVars(['PRIVATE_KEY', `RPC_URL_${chainId}`]);
    
    // Load network configuration
    const networkConfig = getNetworkConfig(chainId as any);
    
    if (!networkConfig.coverageManager) {
      throw new Error(`CoverageManager address not set for chain ${chainId}`);
    }
    
    if (!networkConfig.paymentToken) {
      throw new Error(`Payment token address not set for chain ${chainId}`);
    }
    
    logInfo(`Approving premium for ${networkConfig.name}`, {
      chainId,
      amount,
      coverageManager: networkConfig.coverageManager,
      paymentToken: networkConfig.paymentToken,
      dryRun
    });
    
    // Create clients
    const { publicClient, walletClient, account } = createClients(chainId as any);
    
    // Get token information
    const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
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
    
    logInfo(`Token Information`, {
      name: tokenName,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      address: networkConfig.paymentToken
    });
    
    // Parse amount with correct decimals
    const amountWei = parseTokenAmount(amount, tokenDecimals);
    
    // Check current balance
    const currentBalance = await publicClient.readContract({
      address: networkConfig.paymentToken as `0x${string}`,
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
    
    // Check current allowance
    const currentAllowance = await publicClient.readContract({
      address: networkConfig.paymentToken as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, networkConfig.coverageManager as `0x${string}`]
    });
    
    logInfo(`Current Allowance`, {
      allowance: formatTokenAmount(currentAllowance, tokenDecimals),
      symbol: tokenSymbol,
      spender: networkConfig.coverageManager
    });
    
    // Check if approval is needed
    if (currentAllowance >= amountWei) {
      logSuccess(`Sufficient allowance already exists`, {
        currentAllowance: formatTokenAmount(currentAllowance, tokenDecimals),
        requiredAmount: formatTokenAmount(amountWei, tokenDecimals),
        symbol: tokenSymbol
      });
      return;
    }
    
    if (dryRun) {
      logSuccess(`Dry run completed. Would approve ${formatTokenAmount(amountWei, tokenDecimals)} ${tokenSymbol} to CoverageManager`);
      return;
    }
    
    // Approve tokens
    logInfo(`Approving ${formatTokenAmount(amountWei, tokenDecimals)} ${tokenSymbol} to CoverageManager...`);
    
    const approveHash = await retry(async () => {
      return await walletClient.writeContract({
        address: networkConfig.paymentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [networkConfig.coverageManager as `0x${string}`, amountWei]
      });
    });
    
    // Wait for transaction confirmation
    const receipt = await waitForTransaction(publicClient, approveHash);
    
    if (receipt.status !== 'success') {
      throw new Error('Approval transaction failed');
    }
    
    // Get updated allowance
    const newAllowance = await publicClient.readContract({
      address: networkConfig.paymentToken as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, networkConfig.coverageManager as `0x${string}`]
    });
    
    // Get explorer URL
    const explorerUrl = getExplorerUrl(chainId, approveHash);
    
    logSuccess(`Premium approval successful!`, {
      transactionHash: approveHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
      amountApproved: formatTokenAmount(amountWei, tokenDecimals),
      symbol: tokenSymbol,
      newAllowance: formatTokenAmount(newAllowance, tokenDecimals),
      explorerUrl
    });
    
    console.log(`\n🔗 View on Explorer: ${explorerUrl}`);
    
    return {
      transactionHash: approveHash,
      amountApproved: amountWei,
      newAllowance,
      explorerUrl
    };
    
  } catch (error) {
    handleError(error, 'approvePremium');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(`
Usage: ts-node approvePremium.ts <chainId> [amount] [options]

Arguments:
  chainId      - Chain ID (1=mainnet, 11155111=sepolia, 137=polygon, 42161=arbitrum, 10=optimism)
  amount       - Amount to approve in token units (default: 1000)

Options:
  --dry-run    - Simulate without executing transaction

Examples:
  ts-node approvePremium.ts 1 "1000"                    # Approve 1000 tokens on mainnet
  ts-node approvePremium.ts 11155111 "500" --dry-run    # Dry run on sepolia
  ts-node approvePremium.ts 137 "2000"                  # Approve 2000 tokens on polygon
    `);
    process.exit(1);
  }
  
  const chainId = parseInt(args[0] || '0');
  const amount = args[1] || '1000'; // Default to 1000
  const dryRun = args.includes('--dry-run');
  
  if (chainId === 0) {
    console.error('❌ Chain ID is required');
    process.exit(1);
  }
  
  await approvePremium({
    chainId,
    amount,
    dryRun
  });
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => handleError(error, 'main'));
}

export { approvePremium };
