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
  priceIdToBytes32,
  bytes32ToPriceId
} from './utils';

// Pyth ABI for price fetching
const PYTH_ABI = [
  {
    name: 'getPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      {
        name: 'price',
        type: 'tuple',
        components: [
          { name: 'price', type: 'int64' },
          { name: 'conf', type: 'uint64' },
          { name: 'expo', type: 'int32' },
          { name: 'publishTime', type: 'uint256' }
        ]
      }
    ]
  },
  {
    name: 'getPriceUnsafe',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      {
        name: 'price',
        type: 'tuple',
        components: [
          { name: 'price', type: 'int64' },
          { name: 'conf', type: 'uint64' },
          { name: 'expo', type: 'int32' },
          { name: 'publishTime', type: 'uint256' }
        ]
      }
    ]
  },
  {
    name: 'getPriceNoOlderThan',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'age', type: 'uint256' }
    ],
    outputs: [
      {
        name: 'price',
        type: 'tuple',
        components: [
          { name: 'price', type: 'int64' },
          { name: 'conf', type: 'uint64' },
          { name: 'expo', type: 'int32' },
          { name: 'publishTime', type: 'uint256' }
        ]
      }
    ]
  },
  {
    name: 'getEmaPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      {
        name: 'price',
        type: 'tuple',
        components: [
          { name: 'price', type: 'int64' },
          { name: 'conf', type: 'uint64' },
          { name: 'expo', type: 'int32' },
          { name: 'publishTime', type: 'uint256' }
        ]
      }
    ]
  }
] as const;

// CoverageManager ABI for price operations
const COVERAGE_MANAGER_ABI = [
  {
    name: 'getNormalizedPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'priceId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'checkTokenDrawdown',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenAddress', type: 'address' },
      { name: 'currentPriceId', type: 'bytes32' },
      { name: 'referencePriceId', type: 'bytes32' }
    ],
    outputs: [
      { name: 'hasSignificantDrawdown', type: 'bool' },
      { name: 'drawdownBps', type: 'uint256' }
    ]
  }
] as const;

interface PythPrice {
  price: bigint;
  conf: bigint;
  expo: number;
  publishTime: bigint;
}

interface FetchPythOptions {
  chainId: number;
  priceIds: string[];
  tokenAddress?: string;
  maxAge?: number;
  useEma?: boolean;
  checkDrawdown?: boolean;
}

// Normalize price to 1e18 precision
function normalizePrice(price: bigint, expo: number): bigint {
  const PRECISION = BigInt(10 ** 18);
  
  if (expo >= 0) {
    return price * (PRECISION / BigInt(10 ** expo));
  } else {
    return price * PRECISION / BigInt(10 ** Math.abs(expo));
  }
}

// Calculate drawdown in basis points
function calculateDrawdownBps(currentPrice: bigint, referencePrice: bigint): number {
  if (referencePrice === 0n) return 0;
  
  const drawdown = Number((referencePrice - currentPrice) * 10000n / referencePrice);
  return Math.max(0, drawdown);
}

// Format price for display
function formatPrice(price: bigint, expo: number, decimals: number = 8): string {
  const normalized = normalizePrice(price, expo);
  const divisor = BigInt(10 ** (18 - decimals));
  return (Number(normalized / divisor) / (10 ** decimals)).toFixed(decimals);
}

// Check if price is stale
function isPriceStale(publishTime: bigint, maxAge: number): boolean {
  const currentTime = BigInt(Math.floor(Date.now() / 1000));
  const age = Number(currentTime - publishTime);
  return age > maxAge;
}

async function fetchPythPrices(options: FetchPythOptions) {
  const { chainId, priceIds, tokenAddress, maxAge = 3600, useEma = false, checkDrawdown = false } = options;
  
  try {
    // Validate environment variables
    validateEnvVars(['PRIVATE_KEY', `RPC_URL_${chainId}`]);
    
    // Load network configuration
    const networkConfig = getNetworkConfig(chainId as any);
    
    logInfo(`Fetching Pyth prices for ${networkConfig.name}`, {
      chainId,
      priceIds,
      pythContract: networkConfig.pythContract,
      maxAge,
      useEma,
      checkDrawdown
    });
    
    // Create clients
    const { publicClient } = createClients(chainId as any);
    
    // Fetch prices for each price ID
    const priceResults: Array<{
      priceId: string;
      price: PythPrice;
      normalizedPrice: bigint;
      formattedPrice: string;
      isStale: boolean;
      age: number;
    }> = [];
    
    for (const priceId of priceIds) {
      try {
        const priceIdBytes32 = priceIdToBytes32(priceId);
        
        // Fetch price from Pyth
        const price = await retry(async () => {
          if (useEma) {
            return await publicClient.readContract({
              address: networkConfig.pythContract as `0x${string}`,
              abi: PYTH_ABI,
              functionName: 'getEmaPrice',
              args: [priceIdBytes32]
            });
          } else if (maxAge > 0) {
            return await publicClient.readContract({
              address: networkConfig.pythContract as `0x${string}`,
              abi: PYTH_ABI,
              functionName: 'getPriceNoOlderThan',
              args: [priceIdBytes32, BigInt(maxAge)]
            });
          } else {
            return await publicClient.readContract({
              address: networkConfig.pythContract as `0x${string}`,
              abi: PYTH_ABI,
              functionName: 'getPrice',
              args: [priceIdBytes32]
            });
          }
        });
        
        // Normalize price
        const normalizedPrice = normalizePrice(price.price, price.expo);
        const formattedPrice = formatPrice(price.price, price.expo);
        
        // Check if stale
        const currentTime = BigInt(Math.floor(Date.now() / 1000));
        const age = Number(currentTime - price.publishTime);
        const isStale = isPriceStale(price.publishTime, maxAge);
        
        priceResults.push({
          priceId,
          price,
          normalizedPrice,
          formattedPrice,
          isStale,
          age
        });
        
        logInfo(`Price fetched for ${priceId}`, {
          price: formattedPrice,
          confidence: price.conf.toString(),
          exponent: price.expo,
          publishTime: new Date(Number(price.publishTime) * 1000).toISOString(),
          age: `${age}s`,
          isStale,
          normalizedPrice: normalizedPrice.toString()
        });
        
      } catch (error) {
        logError(`Failed to fetch price for ${priceId}`, error);
      }
    }
    
    // Check drawdown if requested
    if (checkDrawdown && tokenAddress && priceResults.length >= 2) {
      const currentPriceId = priceIdToBytes32(priceResults[0].priceId);
      const referencePriceId = priceIdToBytes32(priceResults[1].priceId);
      
      try {
        const drawdownResult = await publicClient.readContract({
          address: networkConfig.coverageManager as `0x${string}`,
          abi: COVERAGE_MANAGER_ABI,
          functionName: 'checkTokenDrawdown',
          args: [
            tokenAddress as `0x${string}`,
            currentPriceId,
            referencePriceId
          ]
        });
        
        logInfo(`Drawdown check result`, {
          hasSignificantDrawdown: drawdownResult[0],
          drawdownBps: drawdownResult[1].toString(),
          drawdownPercent: `${Number(drawdownResult[1]) / 100}%`
        });
      } catch (error) {
        logError(`Failed to check drawdown`, error);
      }
    }
    
    // Get normalized prices from CoverageManager if available
    if (networkConfig.coverageManager) {
      logInfo(`Fetching normalized prices from CoverageManager...`);
      
      for (const result of priceResults) {
        try {
          const normalizedPrice = await publicClient.readContract({
            address: networkConfig.coverageManager as `0x${string}`,
            abi: COVERAGE_MANAGER_ABI,
            functionName: 'getNormalizedPrice',
            args: [priceIdToBytes32(result.priceId)]
          });
          
          logInfo(`Normalized price from CoverageManager for ${result.priceId}`, {
            normalizedPrice: normalizedPrice.toString(),
            formattedPrice: (Number(normalizedPrice) / 1e18).toFixed(8)
          });
        } catch (error) {
          logError(`Failed to get normalized price for ${result.priceId}`, error);
        }
      }
    }
    
    // Summary
    const validPrices = priceResults.filter(p => !p.isStale);
    const stalePrices = priceResults.filter(p => p.isStale);
    
    logSuccess(`Price fetch completed`, {
      totalPriceIds: priceIds.length,
      validPrices: validPrices.length,
      stalePrices: stalePrices.length,
      results: priceResults.map(p => ({
        priceId: p.priceId,
        price: p.formattedPrice,
        isStale: p.isStale,
        age: `${p.age}s`
      }))
    });
    
    return priceResults;
    
  } catch (error) {
    handleError(error, 'fetchPythPrices');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: ts-node fetchPyth.ts <chainId> <priceIds> [options]

Arguments:
  chainId      - Chain ID (1=mainnet, 11155111=sepolia, 137=polygon, 42161=arbitrum, 10=optimism)
  priceIds     - Comma-separated list of price IDs or use "all" for all supported price IDs

Options:
  --token-address <address>  - Token address for drawdown check
  --max-age <seconds>        - Maximum age for prices (default: 3600)
  --use-ema                  - Use EMA prices instead of spot prices
  --check-drawdown           - Check drawdown between first two prices

Examples:
  ts-node fetchPyth.ts 1 "ETH_USD,BTC_USD"                    # Fetch ETH and BTC prices on mainnet
  ts-node fetchPyth.ts 11155111 "all"                         # Fetch all supported prices on sepolia
  ts-node fetchPyth.ts 1 "ETH_USD,BTC_USD" --check-drawdown   # Check drawdown between ETH and BTC
  ts-node fetchPyth.ts 1 "ETH_USD" --max-age 1800 --use-ema   # Fetch EMA price with 30min max age
    `);
    process.exit(1);
  }
  
  const chainId = parseInt(args[0]);
  const priceIdsArg = args[1];
  
  // Parse price IDs
  let priceIds: string[];
  if (priceIdsArg === 'all') {
    const networkConfig = getNetworkConfig(chainId as any);
    priceIds = Object.keys(networkConfig.priceIds);
  } else {
    priceIds = priceIdsArg.split(',').map(id => id.trim());
  }
  
  // Parse options
  const tokenAddressIndex = args.indexOf('--token-address');
  const tokenAddress = tokenAddressIndex !== -1 ? args[tokenAddressIndex + 1] : undefined;
  
  const maxAgeIndex = args.indexOf('--max-age');
  const maxAge = maxAgeIndex !== -1 ? parseInt(args[maxAgeIndex + 1]) : 3600;
  
  const useEma = args.includes('--use-ema');
  const checkDrawdown = args.includes('--check-drawdown');
  
  await fetchPythPrices({
    chainId,
    priceIds,
    tokenAddress,
    maxAge,
    useEma,
    checkDrawdown
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(handleError);
}

export { fetchPythPrices };
