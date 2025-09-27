import { RugPullEvent } from '@rug-pull-insurance/shared';
import { Logger } from '@rug-pull-insurance/shared';

export class MonitoringService {
  private monitoredTokens: Map<number, Set<string>> = new Map();
  private rugPullEvents: RugPullEvent[] = [];

  async initialize(): Promise<void> {
    Logger.info('Initializing monitoring service...');
    
    // In a real implementation, you would load monitored tokens from a database
    // For now, we'll use a simple in-memory storage
    this.monitoredTokens = new Map();
    this.rugPullEvents = [];
    
    Logger.info('Monitoring service initialized');
  }

  async cleanup(): Promise<void> {
    Logger.info('Cleaning up monitoring service...');
    // Cleanup resources if needed
  }

  async addMonitoredToken(chainId: number, tokenAddress: string): Promise<void> {
    if (!this.monitoredTokens.has(chainId)) {
      this.monitoredTokens.set(chainId, new Set());
    }
    
    this.monitoredTokens.get(chainId)!.add(tokenAddress);
    Logger.info(`Added token ${tokenAddress} to monitoring on chain ${chainId}`);
  }

  async removeMonitoredToken(chainId: number, tokenAddress: string): Promise<void> {
    if (this.monitoredTokens.has(chainId)) {
      this.monitoredTokens.get(chainId)!.delete(tokenAddress);
      Logger.info(`Removed token ${tokenAddress} from monitoring on chain ${chainId}`);
    }
  }

  async getMonitoredTokens(chainId: number): Promise<string[]> {
    const tokens = this.monitoredTokens.get(chainId);
    return tokens ? Array.from(tokens) : [];
  }

  async recordRugPullEvent(event: RugPullEvent): Promise<void> {
    this.rugPullEvents.push(event);
    Logger.info(`Recorded rug pull event: ${event.description}`);
    
    // In a real implementation, you would store this in a database
    // For now, we'll keep it in memory
  }

  async getRugPullEvents(
    tokenAddress?: string,
    severity?: RugPullEvent['severity'],
    limit: number = 100
  ): Promise<RugPullEvent[]> {
    let events = this.rugPullEvents;
    
    if (tokenAddress) {
      events = events.filter(event => event.tokenAddress === tokenAddress);
    }
    
    if (severity) {
      events = events.filter(event => event.severity === severity);
    }
    
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getRugPullEventStats(): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byToken: Record<string, number>;
  }> {
    const total = this.rugPullEvents.length;
    
    const bySeverity = this.rugPullEvents.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byToken = this.rugPullEvents.reduce((acc, event) => {
      acc[event.tokenAddress] = (acc[event.tokenAddress] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return { total, bySeverity, byToken };
  }
}

