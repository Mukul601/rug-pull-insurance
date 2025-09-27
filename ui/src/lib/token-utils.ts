import { useState, useEffect } from 'react';
import { createPublicClient } from '@/lib/contracts';
import { ERC20_ABI } from './contracts';
import { parseUnits, formatUnits } from 'viem';

interface TokenInfo {
  decimals: number;
  symbol: string;
  name: string;
}

// Cache for token info to avoid repeated calls
const tokenInfoCache = new Map<string, TokenInfo>();

export async function getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
  if (tokenInfoCache.has(tokenAddress)) {
    return tokenInfoCache.get(tokenAddress)!;
  }

  try {
    const publicClient = createPublicClient();
    
    const [decimals, symbol, name] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name',
      }),
    ]);

    const tokenInfo: TokenInfo = {
      decimals: Number(decimals),
      symbol: symbol as string,
      name: name as string,
    };

    tokenInfoCache.set(tokenAddress, tokenInfo);
    return tokenInfo;
  } catch (error) {
    console.error('Error fetching token info:', error);
    // Return default values if fetch fails
    return {
      decimals: 18,
      symbol: 'TOKEN',
      name: 'Unknown Token',
    };
  }
}

export function safeParseDecimal(
  value: string,
  decimals: number,
  maxDecimals?: number
): { success: true; value: bigint } | { success: false; error: string } {
  try {
    // Remove any whitespace
    const cleanValue = value.trim();
    
    if (!cleanValue) {
      return { success: false, error: 'Value is required' };
    }

    // Check if value is a valid number
    if (isNaN(Number(cleanValue))) {
      return { success: false, error: 'Invalid number format' };
    }

    // Check for negative values
    if (Number(cleanValue) < 0) {
      return { success: false, error: 'Value cannot be negative' };
    }

    // Check for too many decimal places
    const decimalPlaces = cleanValue.includes('.') 
      ? cleanValue.split('.')[1].length 
      : 0;
    
    if (maxDecimals && decimalPlaces > maxDecimals) {
      return { success: false, error: `Maximum ${maxDecimals} decimal places allowed` };
    }

    // Parse the value
    const parsed = parseUnits(cleanValue, decimals);
    
    // Check for overflow (basic check)
    if (parsed > BigInt(2 ** 256 - 1)) {
      return { success: false, error: 'Value too large' };
    }

    return { success: true, value: parsed };
  } catch (error) {
    return { success: false, error: 'Invalid input format' };
  }
}

export function formatTokenAmount(amount: bigint, decimals: number, displayDecimals?: number): string {
  const formatted = formatUnits(amount, decimals);
  
  if (displayDecimals !== undefined) {
    const num = Number(formatted);
    return num.toFixed(displayDecimals);
  }
  
  return formatted;
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

// Hook for using token info
export function useTokenInfo(tokenAddress: string | undefined) {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenAddress) {
      setTokenInfo(null);
      return;
    }

    const fetchTokenInfo = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const info = await getTokenInfo(tokenAddress);
        setTokenInfo(info);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch token info');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenInfo();
  }, [tokenAddress]);

  return { tokenInfo, isLoading, error };
}

// Re-export for convenience
export { parseUnits, formatUnits };
