/**
 * Get explorer URL for a given chain ID
 */
export function getExplorerUrl(chainId: number): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    137: 'https://polygonscan.com',
    42161: 'https://arbiscan.io',
    10: 'https://optimistic.etherscan.io',
  };
  
  return explorers[chainId] || 'https://etherscan.io';
}

/**
 * Get transaction URL for a given chain ID and transaction hash
 */
export function getTransactionUrl(chainId: number, txHash: string): string {
  const baseUrl = getExplorerUrl(chainId);
  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Get address URL for a given chain ID and address
 */
export function getAddressUrl(chainId: number, address: string): string {
  const baseUrl = getExplorerUrl(chainId);
  return `${baseUrl}/address/${address}`;
}

/**
 * Get block URL for a given chain ID and block number
 */
export function getBlockUrl(chainId: number, blockNumber: string | number): string {
  const baseUrl = getExplorerUrl(chainId);
  return `${baseUrl}/block/${blockNumber}`;
}
