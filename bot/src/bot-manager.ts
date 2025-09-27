import { ethers } from 'ethers';
import { BotConfig, NetworkConfig, RugPullEvent } from '@rug-pull-insurance/shared';
import { DEFAULT_BOT_CONFIG, SUPPORTED_NETWORKS } from '@rug-pull-insurance/shared';
import { Logger } from '@rug-pull-insurance/shared';
import { RugPullDetector } from '@rug-pull-insurance/shared';
import { ContractManager } from '@rug-pull-insurance/shared';
import { MonitoringService } from './services/monitoring-service';
import { AlertService } from './services/alert-service';

export class BotManager {
  private config: BotConfig;
  private providers: Map<number, ethers.Provider> = new Map();
  private contractManagers: Map<number, ContractManager> = new Map();
  private monitoringService: MonitoringService;
  private alertService: AlertService;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.config = {
      intervalMs: parseInt(process.env.BOT_INTERVAL_MS || DEFAULT_BOT_CONFIG.intervalMs.toString()),
      maxRetries: parseInt(process.env.BOT_MAX_RETRIES || DEFAULT_BOT_CONFIG.maxRetries.toString()),
      timeoutMs: parseInt(process.env.BOT_TIMEOUT_MS || DEFAULT_BOT_CONFIG.timeoutMs.toString()),
      enabledChains: DEFAULT_BOT_CONFIG.enabledChains,
    };
    
    this.monitoringService = new MonitoringService();
    this.alertService = new AlertService();
  }

  async initialize(): Promise<void> {
    Logger.info('Initializing bot manager...');
    
    // Initialize providers for each enabled chain
    for (const chainId of this.config.enabledChains) {
      const network = Object.values(SUPPORTED_NETWORKS).find(n => n.chainId === chainId);
      if (!network) {
        Logger.warn(`Network configuration not found for chain ID: ${chainId}`);
        continue;
      }

      try {
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        await provider.getNetwork(); // Test connection
        this.providers.set(chainId, provider);
        
        const contractManager = new ContractManager(provider);
        this.contractManagers.set(chainId, contractManager);
        
        Logger.info(`Connected to ${network.name} (Chain ID: ${chainId})`);
      } catch (error) {
        Logger.error(`Failed to connect to ${network.name}:`, error);
      }
    }

    if (this.providers.size === 0) {
      throw new Error('No providers initialized successfully');
    }

    await this.monitoringService.initialize();
    await this.alertService.initialize();
    
    Logger.info('Bot manager initialized successfully');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('Bot is already running');
      return;
    }

    Logger.info('Starting monitoring...');
    this.isRunning = true;

    // Start monitoring loop
    this.intervalId = setInterval(async () => {
      await this.monitoringCycle();
    }, this.config.intervalMs);

    // Run initial monitoring cycle
    await this.monitoringCycle();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      Logger.warn('Bot is not running');
      return;
    }

    Logger.info('Stopping bot...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    await this.monitoringService.cleanup();
    await this.alertService.cleanup();
    
    Logger.info('Bot stopped successfully');
  }

  private async monitoringCycle(): Promise<void> {
    if (!this.isRunning) return;

    try {
      Logger.debug('Starting monitoring cycle...');
      
      const promises = Array.from(this.contractManagers.entries()).map(
        async ([chainId, contractManager]) => {
          try {
            await this.monitorChain(chainId, contractManager);
          } catch (error) {
            Logger.error(`Error monitoring chain ${chainId}:`, error);
          }
        }
      );

      await Promise.allSettled(promises);
      
      Logger.debug('Monitoring cycle completed');
    } catch (error) {
      Logger.error('Error in monitoring cycle:', error);
    }
  }

  private async monitorChain(chainId: number, contractManager: ContractManager): Promise<void> {
    const network = Object.values(SUPPORTED_NETWORKS).find(n => n.chainId === chainId);
    if (!network) return;

    Logger.debug(`Monitoring ${network.name}...`);

    try {
      // Get monitored tokens from monitoring service
      const monitoredTokens = await this.monitoringService.getMonitoredTokens(chainId);
      
      for (const tokenAddress of monitoredTokens) {
        try {
          await this.analyzeToken(chainId, tokenAddress, contractManager);
        } catch (error) {
          Logger.error(`Error analyzing token ${tokenAddress} on chain ${chainId}:`, error);
        }
      }
    } catch (error) {
      Logger.error(`Error monitoring chain ${chainId}:`, error);
    }
  }

  private async analyzeToken(
    chainId: number,
    tokenAddress: string,
    contractManager: ContractManager
  ): Promise<void> {
    try {
      const tokenContract = await contractManager.getTokenContract(tokenAddress);
      
      // Get current token data
      const [totalSupply, decimals, symbol] = await Promise.all([
        tokenContract.totalSupply(),
        tokenContract.decimals(),
        tokenContract.symbol(),
      ]);

      // Check for rug pull indicators
      const rugPullEvents = await this.detectRugPullIndicators(
        chainId,
        tokenAddress,
        contractManager,
        { totalSupply, decimals, symbol }
      );

      // Process detected events
      for (const event of rugPullEvents) {
        await this.handleRugPullEvent(event);
      }

    } catch (error) {
      Logger.error(`Error analyzing token ${tokenAddress}:`, error);
    }
  }

  private async detectRugPullIndicators(
    chainId: number,
    tokenAddress: string,
    contractManager: ContractManager,
    tokenData: { totalSupply: string; decimals: number; symbol: string }
  ): Promise<RugPullEvent[]> {
    const events: RugPullEvent[] = [];

    try {
      // This is a simplified example - in reality, you'd implement more sophisticated detection logic
      // For now, we'll just check basic token metrics
      
      // Example: Check if total supply is suspiciously low (potential rug pull)
      const supply = parseFloat(tokenData.totalSupply);
      if (supply < 1000) { // Arbitrary threshold
        const event = RugPullDetector.createRugPullEvent(
          tokenAddress,
          0, // blockNumber - would be actual block number
          '', // transactionHash - would be actual tx hash
          'medium',
          `Suspiciously low total supply: ${supply} ${tokenData.symbol}`
        );
        events.push(event);
      }

      // Add more detection logic here...

    } catch (error) {
      Logger.error(`Error detecting rug pull indicators for ${tokenAddress}:`, error);
    }

    return events;
  }

  private async handleRugPullEvent(event: RugPullEvent): Promise<void> {
    try {
      Logger.warn(`Rug pull event detected: ${event.description}`);
      
      // Store event in monitoring service
      await this.monitoringService.recordRugPullEvent(event);
      
      // Send alerts
      await this.alertService.sendAlert(event);
      
    } catch (error) {
      Logger.error('Error handling rug pull event:', error);
    }
  }
}

