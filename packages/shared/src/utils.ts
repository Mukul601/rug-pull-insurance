import { ethers } from 'ethers';
import { viem } from 'viem';
import { NetworkConfig, RugPullEvent } from './types';
import { SUPPORTED_NETWORKS } from './constants';

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

