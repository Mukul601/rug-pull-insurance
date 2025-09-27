import { WebSocketServer, WebSocket } from 'ws';
import { createPublicClient, http } from 'viem';
import { mainnet, sepolia, polygon, arbitrum, optimism } from 'viem/chains';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============ CONFIGURATION ============
const PORT = 8787;
const RPC_URL = process.env.RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11155111');
const COVERAGE_MANAGER_ADDRESS = process.env.COVERAGE_MANAGER_ADDRESS as `0x${string}`;

// ============ CHAIN CONFIGURATION ============
const chains = {
  1: mainnet,
  11155111: sepolia,
  137: polygon,
  42161: arbitrum,
  10: optimism,
} as const;

const getChain = (chainId: number) => {
  const chain = chains[chainId as keyof typeof chains];
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return chain;
};

// ============ COVERAGE MANAGER ABI ============
const COVERAGE_MANAGER_ABI = [
  {
    type: 'event',
    name: 'PolicyCreated',
    inputs: [
      { indexed: true, name: 'policyId', type: 'bytes32' },
      { indexed: true, name: 'policyHolder', type: 'address' },
      { indexed: true, name: 'tokenAddress', type: 'address' },
      { indexed: false, name: 'coverageAmount', type: 'uint256' },
      { indexed: false, name: 'premium', type: 'uint256' },
      { indexed: false, name: 'expiryTime', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'ClaimSettled',
    inputs: [
      { indexed: true, name: 'policyId', type: 'bytes32' },
      { indexed: true, name: 'claimant', type: 'address' },
      { indexed: false, name: 'claimAmount', type: 'uint256' },
      { indexed: false, name: 'drawdownBps', type: 'uint256' },
    ],
  },
] as const;

// ============ TYPES ============
interface EventMessage {
  type: 'event';
  name: string;
  chainId: number;
  blockNumber: bigint;
  args: any;
}

interface HedgeMessage {
  type: 'hedge';
  action: 'open' | 'close';
  policyId: string;
  notional: string;
  leverage: string;
  txHash?: string;
}

type BroadcastMessage = EventMessage | HedgeMessage;

// ============ WEBSOCKET SERVER ============
class HedgeBotWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private publicClient: any;

  constructor() {
    this.wss = new WebSocketServer({ port: PORT });
    this.publicClient = createPublicClient({
      chain: getChain(CHAIN_ID),
      transport: http(RPC_URL),
    });
    
    this.setupWebSocketServer();
    this.setupEventListeners();
    this.startHedgeSimulation();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 Client connected to hedge bot WebSocket');
      this.clients.add(ws);

      ws.on('close', () => {
        console.log('🔌 Client disconnected from hedge bot WebSocket');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send welcome message
      this.broadcast({
        type: 'hedge',
        action: 'open',
        policyId: '0x0000000000000000000000000000000000000000000000000000000000000000',
        notional: '0',
        leverage: '1.0',
      });
    });

    console.log(`🚀 Hedge Bot WebSocket server running on ws://localhost:${PORT}`);
  }

  private setupEventListeners() {
    if (!COVERAGE_MANAGER_ADDRESS) {
      console.warn('⚠️  COVERAGE_MANAGER_ADDRESS not set, event listening disabled');
      return;
    }

    // Listen for PolicyCreated events
    this.publicClient.watchContractEvent({
      address: COVERAGE_MANAGER_ADDRESS,
      abi: COVERAGE_MANAGER_ABI,
      eventName: 'PolicyCreated',
      onLogs: (logs: any[]) => {
        logs.forEach((log: any) => {
          const message: EventMessage = {
            type: 'event',
            name: 'PolicyCreated',
            chainId: CHAIN_ID,
            blockNumber: log.blockNumber,
            args: {
              policyId: log.args.policyId,
              policyHolder: log.args.policyHolder,
              tokenAddress: log.args.tokenAddress,
              coverageAmount: log.args.coverageAmount?.toString(),
              premium: log.args.premium?.toString(),
              expiryTime: log.args.expiryTime?.toString(),
            },
          };
          
          console.log('📋 PolicyCreated event:', message);
          this.broadcast(message);
        });
      },
    });

    // Listen for ClaimSettled events
    this.publicClient.watchContractEvent({
      address: COVERAGE_MANAGER_ADDRESS,
      abi: COVERAGE_MANAGER_ABI,
      eventName: 'ClaimSettled',
      onLogs: (logs: any[]) => {
        logs.forEach((log: any) => {
          const message: EventMessage = {
            type: 'event',
            name: 'ClaimSettled',
            chainId: CHAIN_ID,
            blockNumber: log.blockNumber,
            args: {
              policyId: log.args.policyId,
              claimant: log.args.claimant,
              claimAmount: log.args.claimAmount?.toString(),
              drawdownBps: log.args.drawdownBps?.toString(),
            },
          };
          
          console.log('💰 ClaimSettled event:', message);
          this.broadcast(message);
        });
      },
    });

    console.log('👂 Listening for blockchain events...');
  }

  private startHedgeSimulation() {
    // Simulate hedge actions every 30 seconds
    setInterval(() => {
      this.simulateHedgeAction();
    }, 30000);

    console.log('🤖 Hedge simulation started (every 30 seconds)');
  }

  private simulateHedgeAction() {
    const actions: ('open' | 'close')[] = ['open', 'close'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const policyId = `0x${Math.random().toString(16).substr(2, 64)}`;
    const notional = (Math.random() * 1000000).toFixed(0);
    const leverage = (Math.random() * 5 + 1).toFixed(2);
    const txHash = action === 'open' ? `0x${Math.random().toString(16).substr(2, 64)}` : undefined;

    const message: HedgeMessage = {
      type: 'hedge',
      action,
      policyId,
      notional,
      leverage,
      txHash,
    };

    console.log(`🎯 Hedge ${action}:`, message);
    this.broadcast(message);
  }

  private broadcast(message: BroadcastMessage) {
    const jsonMessage = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(jsonMessage);
        } catch (error) {
          console.error('❌ Failed to send message to client:', error);
          this.clients.delete(client);
        }
      }
    });
  }

  public getStats() {
    return {
      connectedClients: this.clients.size,
      port: PORT,
      chainId: CHAIN_ID,
      coverageManagerAddress: COVERAGE_MANAGER_ADDRESS,
    };
  }
}

// ============ START SERVER ============
if (require.main === module) {
  const server = new HedgeBotWebSocketServer();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down hedge bot WebSocket server...');
    process.exit(0);
  });

  // Log stats every minute
  setInterval(() => {
    const stats = server.getStats();
    console.log('📊 Stats:', stats);
  }, 60000);
}

export { HedgeBotWebSocketServer };
