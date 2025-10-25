import { readFileSync } from 'fs';
import { join } from 'path';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Chain configurations
export const CHAINS = {
  8453: base,
  84532: baseSepolia,
} as const;

export type SupportedChainId = keyof typeof CHAINS;

// Addresses interface
export interface NetworkConfig {
  chainId: number;
  name: string;
  coverageManager: string;
  paymentToken: string;
  pythContract: string;
  priceIds: Record<string, string>;
}

export interface AddressesConfig {
  networks: Record<string, NetworkConfig>;
}

// Load addresses from JSON file with fallback to environment variables
export function loadAddresses(): any {
  try {
    const addressesPath = join(__dirname, 'addresses.json');
    const addressesData = readFileSync(addressesPath, 'utf8');
    return JSON.parse(addressesData);
  } catch (error) {
    console.warn('Failed to load addresses.json, using environment variables only');
    return {};
  }
}

// Get network configuration with fallback to environment variables
export function getNetworkConfig(chainId: SupportedChainId): NetworkConfig {
  const addresses = loadAddresses();
  
  // Determine network name based on chain ID
  let networkName: string;
  if (chainId === 84532) {
    networkName = 'base_sepolia';
  } else if (chainId === 8453) {
    networkName = 'base';
  } else {
    throw new Error(`Unsupported chain ID: ${chainId}. Only Base networks (8453, 84532) are supported.`);
  }
  
  const networkData = addresses[networkName];
  
  // Create network config with fallback to environment variables
  const networkConfig: NetworkConfig = {
    chainId,
    name: chainId === 84532 ? 'Base Sepolia Testnet' : 'Base Mainnet',
    coverageManager: networkData?.CoverageManager || process.env['COVERAGE_MANAGER'] || '',
    paymentToken: networkData?.PremiumToken || process.env['PREMIUM_TOKEN'] || '',
    pythContract: networkData?.Pyth || process.env['PYTH_CONTRACT'] || '',
    priceIds: {
      ETH_USD: networkData?.PriceId || process.env['PRICE_ID'] || ''
    }
  };
  
  return networkConfig;
}

// Create Viem clients
export function createClients(chainId: SupportedChainId) {
  const chain = CHAINS[chainId];
  const rpcUrl = process.env[`RPC_URL_${chainId}`] || process.env.RPC_URL;
  
  if (!rpcUrl) {
    throw new Error(`RPC_URL for chain ${chainId} not found in environment variables`);
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in environment variables');
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  return { publicClient, walletClient, account };
}

// Format token amounts
export function formatTokenAmount(amount: bigint, decimals: number = 6): string {
  return formatUnits(amount, decimals);
}

export function parseTokenAmount(amount: string, decimals: number = 6): bigint {
  return parseUnits(amount, decimals);
}

// Format ETH amounts
export function formatEthAmount(amount: bigint): string {
  return formatEther(amount);
}

export function parseEthAmount(amount: string): bigint {
  return parseEther(amount);
}

// Wait for transaction confirmation
export async function waitForTransaction(
  publicClient: any,
  hash: `0x${string}`,
  confirmations: number = 1
): Promise<any> {
  console.log(`⏳ Waiting for transaction confirmation: ${hash}`);
  
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations,
  });
  
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  return receipt;
}

// Error handling
export function handleError(error: any, context: string): never {
  console.error(`❌ Error in ${context}:`, error);
  process.exit(1);
}

// Logging utilities
export function logInfo(message: string, data?: any) {
  console.log(`ℹ️  ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

export function logSuccess(message: string, data?: any) {
  console.log(`✅ ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

export function logWarning(message: string, data?: any) {
  console.log(`⚠️  ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

export function logError(message: string, error?: any) {
  console.error(`❌ ${message}`);
  if (error) {
    console.error(error);
  }
}

// Validate environment variables
export function validateEnvVars(required: string[]): void {
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// Get chain name from chain ID
export function getChainName(chainId: number): string {
  const chain = CHAINS[chainId as SupportedChainId];
  return chain?.name || `Chain ${chainId}`;
}

// Convert price ID string to bytes32
export function priceIdToBytes32(priceId: string): `0x${string}` {
  if (priceId.startsWith('0x')) {
    return priceId as `0x${string}`;
  }
  return `0x${priceId}` as `0x${string}`;
}

// Convert bytes32 to price ID string
export function bytes32ToPriceId(priceId: `0x${string}`): string {
  return priceId;
}

// Calculate gas price with buffer
export function calculateGasPrice(baseGasPrice: bigint, bufferPercent: number = 20): bigint {
  const buffer = (baseGasPrice * BigInt(bufferPercent)) / BigInt(100);
  return baseGasPrice + buffer;
}

// Retry function with exponential backoff
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i === maxRetries - 1) {
        throw lastError;
      }
      
      const waitTime = delay * Math.pow(2, i);
      console.log(`⏳ Retry ${i + 1}/${maxRetries} in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError!;
}
