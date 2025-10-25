export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface ContractAddresses {
  base?: string;
  base_sepolia?: string;
}

export interface InsurancePolicy {
  id: string;
  tokenAddress: string;
  policyHolder: string;
  coverageAmount: string;
  premium: string;
  expiryDate: number;
  isActive: boolean;
  createdAt: number;
}

export interface RugPullEvent {
  tokenAddress: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface BotConfig {
  intervalMs: number;
  maxRetries: number;
  timeoutMs: number;
  enabledChains: number[];
}

export interface AlertConfig {
  webhookUrl?: string;
  email?: string;
  telegram?: {
    botToken: string;
    chatId: string;
  };
}

