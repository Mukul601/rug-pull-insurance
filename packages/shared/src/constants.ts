import { NetworkConfig } from './types';

export const SUPPORTED_NETWORKS: Record<string, NetworkConfig> = {
  base: {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  base_sepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Sepolia Ether',
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
  enabledChains: [8453, 84532], // base, base_sepolia
} as const;

