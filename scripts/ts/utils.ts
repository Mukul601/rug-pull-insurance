import { readFileSync } from 'fs';
import { join } from 'path';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia, polygon, arbitrum, optimism } from 'viem/chains';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Chain configurations
export const CHAINS = {
  1: mainnet,
  11155111: sepolia,
  137: polygon,
  42161: arbitrum,
  10: optimism,
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

// Load addresses from JSON file
export function loadAddresses(): AddressesConfig {
  try {
    const addressesPath = join(__dirname, 'addresses.json');
    const addressesData = readFileSync(addressesPath, 'utf8');
    return JSON.parse(addressesData) as AddressesConfig;
  } catch (error) {
    console.error('Failed to load addresses.json:', error);
    process.exit(1);
  }
}

// Get network configuration
export function getNetworkConfig(chainId: SupportedChainId): NetworkConfig {
  const addresses = loadAddresses();
  const networkName = Object.keys(addresses.networks).find(
    key => addresses.networks[key].chainId === chainId
  );
  
  if (!networkName) {
    throw new Error(`Network with chainId ${chainId} not found in addresses.json`);
  }
  
  return addresses.networks[networkName];
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
