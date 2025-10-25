/**
 * Get explorer URL for a given chain ID
 */
export function getExplorerUrl(chainId: number): string {
  const explorers: Record<number, string> = {
    8453: 'https://basescan.org',
    84532: 'https://sepolia.basescan.org',
  };
  
  return explorers[chainId] || 'https://sepolia.basescan.org';
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
