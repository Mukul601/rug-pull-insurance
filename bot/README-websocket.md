# Hedge Bot WebSocket Server

A minimal WebSocket server that broadcasts blockchain events and hedge actions for the Rug Pull Insurance project.

## 🚀 Features

- **Port 8787**: WebSocket server runs on `ws://localhost:8787`
- **Event Broadcasting**: Broadcasts `PolicyCreated` and `ClaimSettled` events
- **Hedge Simulation**: Simulates hedge actions (open/close) every 30 seconds
- **Real-time Updates**: Live event streaming to connected clients
- **Simple Setup**: No Express, just pure WebSocket server

## 📦 Installation

```bash
npm install
```

## 🔧 Configuration

Copy the environment file and update with your values:

```bash
cp env.example .env
```

Required environment variables:

```bash
# RPC URL for the blockchain network
RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

# Chain ID (1=mainnet, 11155111=sepolia, 137=polygon, 42161=arbitrum, 10=optimism)
CHAIN_ID=11155111

# CoverageManager Contract Address
COVERAGE_MANAGER_ADDRESS=0x...

# WebSocket Server Port (default: 8787)
PORT=8787
```

## 🚀 Usage

Start the WebSocket server:

```bash
npm run bot:ws
```

The server will:
1. Start on `ws://localhost:8787`
2. Listen for blockchain events (if `COVERAGE_MANAGER_ADDRESS` is set)
3. Simulate hedge actions every 30 seconds
4. Broadcast all events to connected clients

## 📡 Message Formats

### Event Messages
```json
{
  "type": "event",
  "name": "PolicyCreated",
  "chainId": 11155111,
  "blockNumber": "12345678",
  "args": {
    "policyId": "0x...",
    "policyHolder": "0x...",
    "tokenAddress": "0x...",
    "coverageAmount": "1000000000000000000",
    "premium": "100000000000000000",
    "expiryTime": "1234567890"
  }
}
```

### Hedge Messages
```json
{
  "type": "hedge",
  "action": "open",
  "policyId": "0x...",
  "notional": "1000000",
  "leverage": "2.5",
  "txHash": "0x..."
}
```

## 🔌 Client Connection

Connect to the WebSocket server:

```javascript
const ws = new WebSocket('ws://localhost:8787');

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

## 📊 Supported Events

- **PolicyCreated**: When a new insurance policy is created
- **ClaimSettled**: When a claim is settled
- **Hedge Actions**: Simulated open/close hedge actions

## 🛠️ Development

The server automatically:
- Reconnects to blockchain events
- Handles client disconnections
- Logs all activities
- Provides stats every minute

## 📝 Notes

- No auto-reconnect handling (kept simple as requested)
- Hedge actions are simulated for demonstration
- Real blockchain events require `COVERAGE_MANAGER_ADDRESS` to be set
- Server runs indefinitely until manually stopped
