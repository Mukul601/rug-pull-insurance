import { ethers } from 'ethers';
import { viem } from 'viem';
import { NetworkConfig, RugPullEvent } from './types';
import { SUPPORTED_NETWORKS } from './constants';
import { readFileSync } from 'fs';
import { join } from 'path';

export class NetworkUtils {
  static getNetworkConfig(chainId: number): NetworkConfig | undefined {
    return Object.values(SUPPORTED_NETWORKS).find(network => network.chainId === chainId);
  }

  static getNetworkName(chainId: number): string {
    const config = this.getNetworkConfig(chainId);
    return config?.name || `Unknown Chain (${chainId})`;
  }

  static formatAddress(address: string): string {
    if (!ethers.isAddress(address)) {
      throw new Error('Invalid address format');
    }
    return ethers.getAddress(address);
  }

  static formatTokenAmount(amount: string, decimals: number = 18): string {
    try {
      return ethers.formatUnits(amount, decimals);
    } catch (error) {
      throw new Error(`Failed to format token amount: ${error}`);
    }
  }

  static parseTokenAmount(amount: string, decimals: number = 18): string {
    try {
      return ethers.parseUnits(amount, decimals).toString();
    } catch (error) {
      throw new Error(`Failed to parse token amount: ${error}`);
    }
  }
}

export class RugPullDetector {
  static detectLiquidityRemoval(
    currentLiquidity: string,
    previousLiquidity: string,
    threshold: number = 0.8
  ): boolean {
    const current = parseFloat(currentLiquidity);
    const previous = parseFloat(previousLiquidity);
    
    if (previous === 0) return false;
    
    const removalPercentage = (previous - current) / previous;
    return removalPercentage >= threshold;
  }

  static detectPriceManipulation(
    currentPrice: string,
    previousPrice: string,
    threshold: number = 0.9
  ): boolean {
    const current = parseFloat(currentPrice);
    const previous = parseFloat(previousPrice);
    
    if (previous === 0) return false;
    
    const priceDropPercentage = (previous - current) / previous;
    return priceDropPercentage >= threshold;
  }

  static createRugPullEvent(
    tokenAddress: string,
    blockNumber: number,
    transactionHash: string,
    severity: RugPullEvent['severity'],
    description: string
  ): RugPullEvent {
    return {
      tokenAddress: NetworkUtils.formatAddress(tokenAddress),
      blockNumber,
      transactionHash,
      timestamp: Math.floor(Date.now() / 1000),
      severity,
      description,
    };
  }
}

export class Logger {
  private static logLevel: string = process.env.LOG_LEVEL || 'info';
  
  private static shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  static error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  static warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  static info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }

  static debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
}

export class AddressUtils {
  private static addressesCache: any = null;

  static loadAddresses(): any {
    if (this.addressesCache) {
      return this.addressesCache;
    }

    try {
      const addressesPath = join(__dirname, '../addresses.json');
      const addressesData = readFileSync(addressesPath, 'utf8');
      this.addressesCache = JSON.parse(addressesData);
      return this.addressesCache;
    } catch (error) {
      console.warn('Failed to load addresses.json, using environment variables only');
      return {};
    }
  }

  static getCoverageManager(network: 'base_sepolia' | 'base' = 'base_sepolia'): string {
    const addresses = this.loadAddresses();
    const address = addresses[network]?.CoverageManager;
    
    if (address && address !== '') {
      return address;
    }
    
    // Fallback to environment variable
    return process.env['COVERAGE_MANAGER'] || '';
  }

  static getPremiumToken(network: 'base_sepolia' | 'base' = 'base_sepolia'): string {
    const addresses = this.loadAddresses();
    const address = addresses[network]?.PremiumToken;
    
    if (address && address !== '') {
      return address;
    }
    
    // Fallback to environment variable
    return process.env['PREMIUM_TOKEN'] || '';
  }

  static getPyth(network: 'base_sepolia' | 'base' = 'base_sepolia'): string {
    const addresses = this.loadAddresses();
    const address = addresses[network]?.Pyth;
    
    if (address && address !== '') {
      return address;
    }
    
    // Fallback to environment variable
    return process.env['PYTH_CONTRACT'] || '';
  }

  static getPriceId(network: 'base_sepolia' | 'base' = 'base_sepolia'): string {
    const addresses = this.loadAddresses();
    const priceId = addresses[network]?.PriceId;
    
    if (priceId && priceId !== '') {
      return priceId;
    }
    
    // Fallback to environment variable
    return process.env['PRICE_ID'] || '';
  }

  static updateAddress(network: 'base_sepolia' | 'base', key: 'CoverageManager' | 'PremiumToken' | 'Pyth' | 'PriceId', value: string): void {
    const addresses = this.loadAddresses();
    if (!addresses[network]) {
      addresses[network] = {};
    }
    addresses[network][key] = value;
    this.addressesCache = addresses;
  }
}

