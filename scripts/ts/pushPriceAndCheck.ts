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
  priceIdToBytes32,
  parseTokenAmount,
  formatTokenAmount
} from './utils';

// Pyth ABI for price updates
const PYTH_ABI = [
  {
    name: 'updatePriceFeeds',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: []
  },
  {
    name: 'getUpdateFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: [{ name: 'fee', type: 'uint256' }]
  },
  {
    name: 'getPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      {
        name: 'price',
        type: 'tuple',
        components: [
          { name: 'price', type: 'int64' },
          { name: 'conf', type: 'uint64' },
          { name: 'expo', type: 'int32' },
          { name: 'publishTime', type: 'uint256' }
        ]
      }
    ]
  }
] as const;

// CoverageManager ABI for price operations
const COVERAGE_MANAGER_ABI = [
  {
    name: 'updatePriceFeeds',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: []
  },
  {
    name: 'checkTokenDrawdown',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'currentPriceId', type: 'bytes32' },
      { name: 'referencePriceId', type: 'bytes32' }
    ],
    outputs: [
      { name: 'hasSignificantDrawdown', type: 'bool' },
      { name: 'drawdownBps', type: 'uint256' }
    ]
  },
  {
    name: 'getNormalizedPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'priceId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'isPriceBelowThreshold',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'priceId', type: 'bytes32' },
      { name: 'threshold', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

interface PushPriceOptions {
  chainId: number;
  priceIds: string[];
  updateData: string[];
  tokenAddress?: string;
  checkDrawdown?: boolean;
  checkThreshold?: boolean;
  threshold?: string;
  dryRun?: boolean;
}

// Mock price update data generator (for testing)
function generateMockUpdateData(priceIds: string[]): string[] {
  return priceIds.map(priceId => {
    // This is a mock implementation - in production, you would get real update data from Pyth
    const mockData = `0x${priceId.replace('0x', '')}${'0'.repeat(64)}`;
    return mockData;
  });
}

// Get real update data from Pyth (placeholder - would need actual Pyth SDK integration)
async function getRealUpdateData(priceIds: string[]): Promise<string[]> {
  // In a real implementation, you would:
  // 1. Use Pyth SDK to fetch update data
  // 2. Handle different networks and price IDs
  // 3. Return actual update data bytes
  
  logInfo('Using mock update data - in production, integrate with Pyth SDK');
  return generateMockUpdateData(priceIds);
}

async function pushPriceAndCheck(options: PushPriceOptions) {
  const { 
    chainId, 
    priceIds, 
    updateData, 
    tokenAddress, 
    checkDrawdown = false, 
    checkThreshold = false, 
    threshold = "1000000000000000000", // 1.0 in 1e18
    dryRun = false 
  } = options;
  
  try {
    // Validate environment variables
    validateEnvVars(['PRIVATE_KEY', `RPC_URL_${chainId}`]);
    
    // Load network configuration
    const networkConfig = getNetworkConfig(chainId as any);
    
    logInfo(`Pushing prices and checking conditions for ${networkConfig.name}`, {
      chainId,
      priceIds,
      pythContract: networkConfig.pythContract,
      coverageManager: networkConfig.coverageManager,
      checkDrawdown,
      checkThreshold,
      threshold,
      dryRun
    });
    
    // Create clients
    const { publicClient, walletClient } = createClients(chainId as any);
    
    // Get update data if not provided
    let finalUpdateData = updateData;
    if (finalUpdateData.length === 0) {
      logInfo('No update data provided, generating mock data...');
      finalUpdateData = await getRealUpdateData(priceIds);
    }
    
    // Get update fee from Pyth
    const updateFee = await publicClient.readContract({
      address: networkConfig.pythContract as `0x${string}`,
      abi: PYTH_ABI,
      functionName: 'getUpdateFee',
      args: [finalUpdateData.map(d => d as `0x${string}`)]
    });
    
    logInfo(`Update fee required`, {
      fee: updateFee.toString(),
      feeEth: (Number(updateFee) / 1e18).toFixed(6)
    });
    
    if (dryRun) {
      logSuccess(`Dry run completed. Would update ${priceIds.length} price feeds with fee ${updateFee.toString()} wei`);
      return;
    }
    
    // Update prices via CoverageManager
    logInfo(`Updating price feeds via CoverageManager...`);
    
    const updateHash = await retry(async () => {
      return await walletClient.writeContract({
        address: networkConfig.coverageManager as `0x${string}`,
        abi: COVERAGE_MANAGER_ABI,
        functionName: 'updatePriceFeeds',
        args: [finalUpdateData.map(d => d as `0x${string}`)],
        value: updateFee
      });
    });
    
    // Wait for transaction confirmation
    const receipt = await retry(async () => {
      return await publicClient.waitForTransactionReceipt({
        hash: updateHash,
        confirmations: 1
      });
    });
    
    if (receipt.status !== 'success') {
      throw new Error('Price update transaction failed');
    }
    
    logSuccess(`Price feeds updated successfully`, {
      transactionHash: updateHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString()
    });
    
    // Check conditions after price update
    const checkResults: any = {};
    
    // Check drawdown if requested
    if (checkDrawdown && tokenAddress && priceIds.length >= 2) {
      const currentPriceId = priceIdToBytes32(priceIds[0]);
      const referencePriceId = priceIdToBytes32(priceIds[1]);
      
      try {
        const drawdownResult = await publicClient.readContract({
          address: networkConfig.coverageManager as `0x${string}`,
          abi: COVERAGE_MANAGER_ABI,
          functionName: 'checkTokenDrawdown',
          args: [
            tokenAddress as `0x${string}`,
            currentPriceId,
            referencePriceId
          ]
        });
        
        checkResults.drawdown = {
          hasSignificantDrawdown: drawdownResult[0],
          drawdownBps: drawdownResult[1].toString(),
          drawdownPercent: `${Number(drawdownResult[1]) / 100}%`
        };
        
        logInfo(`Drawdown check result`, checkResults.drawdown);
      } catch (error) {
        logError(`Failed to check drawdown`, error);
        checkResults.drawdown = { error: 'Failed to check drawdown' };
      }
    }
    
    // Check threshold if requested
    if (checkThreshold && priceIds.length > 0) {
      const thresholdWei = BigInt(threshold);
      
      for (const priceId of priceIds) {
        try {
          const isBelowThreshold = await publicClient.readContract({
            address: networkConfig.coverageManager as `0x${string}`,
            abi: COVERAGE_MANAGER_ABI,
            functionName: 'isPriceBelowThreshold',
            args: [priceIdToBytes32(priceId), thresholdWei]
          });
          
          const normalizedPrice = await publicClient.readContract({
            address: networkConfig.coverageManager as `0x${string}`,
            abi: COVERAGE_MANAGER_ABI,
            functionName: 'getNormalizedPrice',
            args: [priceIdToBytes32(priceId)]
          });
          
          checkResults[priceId] = {
            isBelowThreshold,
            normalizedPrice: normalizedPrice.toString(),
            threshold: thresholdWei.toString(),
            formattedPrice: (Number(normalizedPrice) / 1e18).toFixed(8)
          };
          
          logInfo(`Threshold check for ${priceId}`, checkResults[priceId]);
        } catch (error) {
          logError(`Failed to check threshold for ${priceId}`, error);
          checkResults[priceId] = { error: 'Failed to check threshold' };
        }
      }
    }
    
    // Get updated prices from Pyth
    logInfo(`Fetching updated prices from Pyth...`);
    
    for (const priceId of priceIds) {
      try {
        const price = await publicClient.readContract({
          address: networkConfig.pythContract as `0x${string}`,
          abi: PYTH_ABI,
          functionName: 'getPrice',
          args: [priceIdToBytes32(priceId)]
        });
        
        const publishTime = new Date(Number(price.publishTime) * 1000);
        const age = Math.floor((Date.now() - publishTime.getTime()) / 1000);
        
        logInfo(`Updated price for ${priceId}`, {
          price: price.price.toString(),
          confidence: price.conf.toString(),
          exponent: price.expo,
          publishTime: publishTime.toISOString(),
          age: `${age}s`
        });
      } catch (error) {
        logError(`Failed to fetch updated price for ${priceId}`, error);
      }
    }
    
    // Summary
    logSuccess(`Price push and check completed`, {
      transactionHash: updateHash,
      priceIdsUpdated: priceIds.length,
      checkResults
    });
    
    return {
      transactionHash: updateHash,
      checkResults
    };
    
  } catch (error) {
    handleError(error, 'pushPriceAndCheck');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: ts-node pushPriceAndCheck.ts <chainId> <priceIds> [options]

Arguments:
  chainId      - Chain ID (1=mainnet, 11155111=sepolia, 137=polygon, 42161=arbitrum, 10=optimism)
  priceIds     - Comma-separated list of price IDs

Options:
  --update-data <data1,data2,...>  - Comma-separated update data (if not provided, mock data will be used)
  --token-address <address>        - Token address for drawdown check
  --check-drawdown                 - Check drawdown between first two prices
  --check-threshold                - Check if prices are below threshold
  --threshold <value>              - Threshold value in 1e18 units (default: 1000000000000000000)
  --dry-run                        - Simulate without executing transaction

Examples:
  ts-node pushPriceAndCheck.ts 1 "ETH_USD,BTC_USD"                    # Update ETH and BTC prices
  ts-node pushPriceAndCheck.ts 11155111 "ETH_USD" --check-threshold    # Update ETH price and check threshold
  ts-node pushPriceAndCheck.ts 1 "ETH_USD,BTC_USD" --check-drawdown --token-address 0x...  # Check drawdown
  ts-node pushPriceAndCheck.ts 1 "ETH_USD" --threshold 2000000000000000000 --dry-run  # Dry run with custom threshold
    `);
    process.exit(1);
  }
  
  const chainId = parseInt(args[0]);
  const priceIds = args[1].split(',').map(id => id.trim());
  
  // Parse options
  const updateDataIndex = args.indexOf('--update-data');
  const updateData = updateDataIndex !== -1 ? args[updateDataIndex + 1].split(',').map(d => d.trim()) : [];
  
  const tokenAddressIndex = args.indexOf('--token-address');
  const tokenAddress = tokenAddressIndex !== -1 ? args[tokenAddressIndex + 1] : undefined;
  
  const checkDrawdown = args.includes('--check-drawdown');
  const checkThreshold = args.includes('--check-threshold');
  
  const thresholdIndex = args.indexOf('--threshold');
  const threshold = thresholdIndex !== -1 ? args[thresholdIndex + 1] : "1000000000000000000";
  
  const dryRun = args.includes('--dry-run');
  
  await pushPriceAndCheck({
    chainId,
    priceIds,
    updateData,
    tokenAddress,
    checkDrawdown,
    checkThreshold,
    threshold,
    dryRun
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(handleError);
}

export { pushPriceAndCheck };
