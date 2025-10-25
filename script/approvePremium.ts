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
  chain?: 'base' | 'base_sepolia';
}

async function approvePremium(options: ApprovePremiumOptions) {
  const { chainId, amount, dryRun = false, chain } = options;
  
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
    
    logInfo(`Approving premium for ${networkConfig.name}`, {
      chainId,
      amount,
      coverageManager: networkConfig.coverageManager,
      paymentToken: networkConfig.paymentToken,
      dryRun
    });
    
    // Create clients with custom RPC URL
    const { publicClient, walletClient, account } = createClients(chainId as any, rpcUrl);
    
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
  chainId      - Chain ID (8453=base, 84532=base_sepolia)
  amount       - Amount to approve in token units (default: 1000)

Options:
  --chain <chain>  - Override chain selection (base or base_sepolia)
  --dry-run        - Simulate without executing transaction

Examples:
  ts-node approvePremium.ts 84532 "1000"                    # Approve 1000 tokens on base_sepolia
  ts-node approvePremium.ts 84532 "500" --dry-run           # Dry run on base_sepolia
  ts-node approvePremium.ts 8453 "2000" --chain base        # Approve 2000 tokens on base
    `);
    process.exit(1);
  }
  
  const chainId = parseInt(args[0] || '0');
  const amount = args[1] || '1000'; // Default to 1000
  
  // Parse options
  const dryRun = args.includes('--dry-run');
  const chainIndex = args.indexOf('--chain');
  const chain = chainIndex !== -1 && args[chainIndex + 1] ? args[chainIndex + 1] as 'base' | 'base_sepolia' : undefined;
  
  if (chainId === 0) {
    console.error('❌ Chain ID is required');
    process.exit(1);
  }
  
  await approvePremium({
    chainId,
    amount,
    dryRun,
    chain
  });
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => handleError(error, 'main'));
}

export { approvePremium };
