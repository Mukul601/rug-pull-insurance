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
  getExplorerUrl
} from './utils';

// Pyth ABI for update operations
const PYTH_ABI = [
  {
    name: 'getUpdateFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: [{ name: 'fee', type: 'uint256' }]
  },
  {
    name: 'updatePriceFeeds',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: []
  }
] as const;

// CoverageManager ABI for update operations
const COVERAGE_MANAGER_ABI = [
  {
    name: 'updatePriceFeeds',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'updateData', type: 'bytes[]' }],
    outputs: []
  }
] as const;

interface HermesResponse {
  binary: string;
}

interface FetchPythOptions {
  chainId: number;
  priceId: string;
  useCoverageManager?: boolean;
}

async function fetchPriceUpdatesFromHermes(priceId: string): Promise<string[]> {
  try {
    logInfo(`Fetching price updates from Hermes for price ID: ${priceId}`);
    
    const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${priceId}&binary=true&encoding=hex`;
    
    logInfo(`Hermes URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: HermesResponse = await response.json();
    
    if (!data.binary) {
      throw new Error('No binary data received from Hermes');
    }
    
    // Parse the binary data into bytes[] format
    // The response should be a hex string that we need to convert to 0x-prefixed format
    const binaryData = data.binary.startsWith('0x') ? data.binary : `0x${data.binary}`;
    
    logInfo(`Received binary data from Hermes`, {
      length: binaryData.length,
      preview: binaryData.substring(0, 100) + '...'
    });
    
    // Return as array of bytes (in this case, just one update)
    return [binaryData];
    
  } catch (error) {
    logError(`Failed to fetch price updates from Hermes`, error);
    throw error;
  }
}

async function fetchPythUpdates(options: FetchPythOptions) {
  const { chainId, priceId, useCoverageManager = false } = options;
  
  try {
    // Validate environment variables
    validateEnvVars(['PRIVATE_KEY', `RPC_URL_${chainId}`]);
    
    // Load network configuration
    const networkConfig = getNetworkConfig(chainId as any);
    
    if (!networkConfig.pythContract) {
      throw new Error('Pyth contract address not found in network configuration');
    }
    
    logInfo(`Fetching Pyth price updates for ${networkConfig.name}`, {
      chainId,
      priceId,
      pythContract: networkConfig.pythContract,
      coverageManager: networkConfig.coverageManager,
      useCoverageManager
    });
    
    // Create clients
    const { publicClient, walletClient, account } = createClients(chainId as any);
    
    // Fetch price updates from Hermes
    const updateData = await retry(async () => {
      return await fetchPriceUpdatesFromHermes(priceId);
    });
    
    logInfo(`Fetched ${updateData.length} price update(s) from Hermes`);
    
    // Get update fee from Pyth contract
    logInfo(`Getting update fee from Pyth contract...`);
    const updateFee = await retry(async () => {
      return await publicClient.readContract({
        address: networkConfig.pythContract as `0x${string}`,
        abi: PYTH_ABI,
        functionName: 'getUpdateFee',
        args: [updateData]
      });
    });
    
    logInfo(`Update fee: ${updateFee.toString()} wei (${Number(updateFee) / 1e18} ETH)`);
    
    // Choose contract to update
    const targetContract = useCoverageManager && networkConfig.coverageManager 
      ? networkConfig.coverageManager 
      : networkConfig.pythContract;
    
    const targetABI = useCoverageManager ? COVERAGE_MANAGER_ABI : PYTH_ABI;
    const contractName = useCoverageManager ? 'CoverageManager' : 'Pyth';
    
    logInfo(`Updating ${contractName} contract with price feeds...`, {
      contract: targetContract,
      updateDataCount: updateData.length,
      fee: updateFee.toString()
    });
    
    // Update price feeds
    const txHash = await retry(async () => {
      return await walletClient.writeContract({
        address: targetContract as `0x${string}`,
        abi: targetABI,
        functionName: 'updatePriceFeeds',
        args: [updateData],
        value: updateFee
      });
    });
    
    logSuccess(`Price feeds updated successfully!`, {
      contract: contractName,
      txHash,
      explorerUrl: getExplorerUrl(txHash, 'tx'),
      fee: updateFee.toString(),
      feeEth: `${Number(updateFee) / 1e18} ETH`,
      updateDataCount: updateData.length
    });
    
    // Wait for transaction confirmation
    logInfo(`Waiting for transaction confirmation...`);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60000
    });
    
    if (receipt.status === 'success') {
      logSuccess(`Transaction confirmed!`, {
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString()
      });
    } else {
      logError(`Transaction failed!`, { receipt });
    }
    
    return {
      txHash,
      fee: updateFee,
      receipt,
      updateDataCount: updateData.length
    };
    
  } catch (error) {
    handleError(error, 'fetchPythUpdates');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: ts-node fetchPyth.ts <chainId> <priceId> [options]

Arguments:
  chainId      - Chain ID (1=mainnet, 11155111=sepolia, 137=polygon, 42161=arbitrum, 10=optimism)
  priceId      - Pyth price ID (e.g., ETH_USD, BTC_USD, etc.)

Options:
  --use-coverage-manager  - Use CoverageManager contract instead of Pyth contract
  --help                  - Show this help message

Examples:
  ts-node fetchPyth.ts 1 "ETH_USD"                           # Update ETH price on mainnet
  ts-node fetchPyth.ts 11155111 "BTC_USD"                    # Update BTC price on sepolia
  ts-node fetchPyth.ts 1 "ETH_USD" --use-coverage-manager    # Update via CoverageManager
    `);
    process.exit(1);
  }
  
  const chainId = parseInt(args[0]);
  const priceId = args[1];
  const useCoverageManager = args.includes('--use-coverage-manager');
  
  if (isNaN(chainId)) {
    logError('Invalid chain ID provided');
    process.exit(1);
  }
  
  if (!priceId) {
    logError('Price ID is required');
    process.exit(1);
  }
  
  await fetchPythUpdates({
    chainId,
    priceId,
    useCoverageManager
  });
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => handleError(error, 'main'));
}

export { fetchPythUpdates };
