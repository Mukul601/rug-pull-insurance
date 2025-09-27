import { NetworkConfig } from './types';

export const SUPPORTED_NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: process.env.RPC_URL_MAINNET || '',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  sepolia: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: process.env.RPC_URL_SEPOLIA || '',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: process.env.RPC_URL_POLYGON || '',
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18,
    },
  },
  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    rpcUrl: process.env.RPC_URL_ARBITRUM || '',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: process.env.RPC_URL_OPTIMISM || '',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
};

export const RUG_PULL_INDICATORS = {
  LIQUIDITY_REMOVAL_THRESHOLD: 0.8, // 80% liquidity removal
  HOLDER_REDISTRIBUTION_THRESHOLD: 0.5, // 50% of holders lose tokens
  PRICE_DROP_THRESHOLD: 0.9, // 90% price drop
  SUSPICIOUS_TRANSACTION_COUNT: 10, // 10+ suspicious transactions
  LARGE_HOLDER_EXIT_THRESHOLD: 0.3, // 30% of large holders exit
} as const;

export const CONTRACT_EVENTS = {
  POLICY_CREATED: 'PolicyCreated',
  POLICY_CANCELLED: 'PolicyCancelled',
  CLAIM_FILED: 'ClaimFiled',
  CLAIM_APPROVED: 'ClaimApproved',
  CLAIM_DENIED: 'ClaimDenied',
  RUG_PULL_DETECTED: 'RugPullDetected',
} as const;

export const DEFAULT_BOT_CONFIG = {
  intervalMs: 60000, // 1 minute
  maxRetries: 3,
  timeoutMs: 30000, // 30 seconds
  enabledChains: [1, 11155111, 137, 42161, 10], // mainnet, sepolia, polygon, arbitrum, optimism
} as const;

