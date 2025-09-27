import { createPublicClient as viemCreatePublicClient, createWalletClient as viemCreateWalletClient, http, type Address, type Chain } from 'viem';
import { mainnet, sepolia, polygon, arbitrum, optimism } from 'viem/chains';
import CoverageManagerABIData from '../../../packages/shared/abi.json';

// ============ ENVIRONMENT VARIABLES ============
export const addresses = {
  coverageManager: process.env.NEXT_PUBLIC_COVERAGE_MANAGER as Address,
  premiumToken: process.env.NEXT_PUBLIC_PREMIUM_TOKEN as Address,
  pyth: process.env.NEXT_PUBLIC_PYTH as Address,
} as const;

export const config = {
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY',
} as const;

// ============ CHAIN CONFIGURATION ============
const chains = {
  1: mainnet,
  11155111: sepolia,
  137: polygon,
  42161: arbitrum,
  10: optimism,
} as const;

export type SupportedChainId = keyof typeof chains;

export function getChain(chainId: number): Chain {
  const chain = chains[chainId as SupportedChainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return chain;
}

// ============ ABI EXPORTS ============
export const CoverageManagerABI = CoverageManagerABIData.CoverageManager;

// ERC20 ABI for token operations
export const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
] as const;

// ============ CLIENT FACTORIES ============
export function createPublicClient(chainId?: number) {
  const targetChainId = chainId || config.chainId;
  const chain = getChain(targetChainId);
  const rpcUrl = process.env[`NEXT_PUBLIC_RPC_URL_${targetChainId}`] || config.rpcUrl;

  return viemCreatePublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

export function createWalletClient(chainId?: number) {
  const targetChainId = chainId || config.chainId;
  const chain = getChain(targetChainId);
  const rpcUrl = process.env[`NEXT_PUBLIC_RPC_URL_${targetChainId}`] || config.rpcUrl;

  return viemCreateWalletClient({
    chain,
    transport: http(rpcUrl),
  });
}

// ============ CONTRACT ADDRESS VALIDATION ============
export function validateAddresses() {
  const missing = [];
  
  if (!addresses.coverageManager) missing.push('NEXT_PUBLIC_COVERAGE_MANAGER');
  if (!addresses.premiumToken) missing.push('NEXT_PUBLIC_PREMIUM_TOKEN');
  if (!addresses.pyth) missing.push('NEXT_PUBLIC_PYTH');
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// ============ UTILITY FUNCTIONS ============
export function formatAddress(address: Address): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function isValidAddress(address: string): address is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function getExplorerUrl(chainId: number, hash: string, type: 'tx' | 'address' = 'tx'): string {
  const explorers = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    137: 'https://polygonscan.com',
    42161: 'https://arbiscan.io',
    10: 'https://optimistic.etherscan.io',
  };
  
  const baseUrl = explorers[chainId as SupportedChainId];
  if (!baseUrl) {
    throw new Error(`No explorer URL for chain ID: ${chainId}`);
  }
  
  return `${baseUrl}/${type}/${hash}`;
}

// ============ TYPE EXPORTS ============
export type { Address, Chain };