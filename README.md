# Rug Pull Insurance

A comprehensive Foundry + Node.js hybrid repository for building a rug pull insurance system.

## Project Structure

```
├── contracts/          # Solidity smart contracts
├── script/            # Foundry deployment scripts
├── bot/               # Node.js monitoring bot
├── packages/shared/   # Shared TypeScript utilities
├── test/              # Foundry tests
├── foundry.toml       # Foundry configuration
├── package.json       # Node.js dependencies
├── tsconfig.json      # TypeScript configuration
└── .env.example       # Environment variables template
```

## One-Command Demo

Run the complete demo with a single command:

```bash
npm run demo:fast   # full loop without Hermes (0% trigger)
npm run demo:pyth   # full loop with real Pyth pull
```

The demo will:
- Start the UI and bot
- Deploy CoverageManager (or reuse existing)
- Update environment files
- Seed reserves
- Approve and buy a policy
- Make it claimable (fast = 0% trigger, pyth = real Pyth pull)
- Settle the claim
- Print explorer links and summary

### Troubleshooting

- If UI doesn't show events, verify `NEXT_PUBLIC_*` in `/ui/.env` and restart `npm run dev`
- If pyth step fails, check `PYTH_CONTRACT` and `PRICE_ID` against Pyth docs, or use `demo:fast`
- If deployment fails, ensure you have sufficient ETH for gas fees

## Features

### Smart Contracts
- **CoverageManager**: Main insurance contract with policy management
- **MockERC20**: Optional test token for development and testing
- **MockPyth**: Optional mock price oracle for testing (uses real Pyth on mainnet)
- Comprehensive test suite with Foundry

### Monitoring Bot
- Real-time token monitoring across multiple networks
- Rug pull detection algorithms
- Alert system with webhook, Telegram, and email support
- Configurable monitoring intervals and thresholds

### Shared Package
- TypeScript utilities and types
- Network configuration management
- Contract interaction helpers
- Logging and error handling

## Quick Start

### Prerequisites
- Node.js 18+
- Foundry
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rug-pull-insurance
```

2. Install dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
# Root environment variables
cp .env.example .env
# Edit .env with your configuration

# UI environment variables
cp ui/.env.example ui/.env.local
# Edit ui/.env.local with your contract addresses
```

### Development

#### Smart Contracts
```bash
# Compile contracts
forge build

# Run tests
forge test

# Run tests with coverage
forge coverage

# Deploy to local network
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

#### Monitoring Bot
```bash
# Start bot in development mode
npm run bot:dev

# Build bot
npm run bot:build

# Start bot in production
npm run bot:start
```

#### Shared Package
```bash
# Build shared package
npm run shared:build

# Watch mode for development
npm run shared:dev
```

## Configuration

### Foundry Configuration
The `foundry.toml` file contains:
- Solidity compiler settings
- Optimizer configuration
- RPC endpoints for different networks
- Etherscan API keys for verification
- **Default RPC**: Set to `base_sepolia` for scripts and tests

#### Environment Variables

**Root `.env` file:**
```bash
# Private Key (required for deployment and transactions)
PRIVATE_KEY=your_private_key_here

# Base RPC URLs (required for foundry.toml)
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Contract Addresses
PREMIUM_TOKEN=0x...   # MockERC20 or USDC test token on Base Sepolia
PYTH_CONTRACT=0x...   # optional: Pyth on Base
PRICE_ID=0x...        # optional: ETH/USD feed id
```

**UI `.env.local` file:**
```bash
# Base Network Configuration
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_COVERAGE_MANAGER=0x...
NEXT_PUBLIC_PREMIUM_TOKEN=0x...
NEXT_PUBLIC_PYTH=0x...
NEXT_PUBLIC_PRICE_ID=0x...
```

### Bot Configuration
Configure the monitoring bot through environment variables:
- `BOT_INTERVAL_MS`: Monitoring interval in milliseconds
- `BOT_MAX_RETRIES`: Maximum retry attempts
- `BOT_TIMEOUT_MS`: Request timeout in milliseconds

### Network Configuration
Supported networks:
- Ethereum Mainnet
- Sepolia Testnet
- Base Mainnet
- Base Sepolia Testnet

## Deployment

### Testnet Deployment
```bash
# Deploy to Base Sepolia testnet
npm run deploy:base-sepolia

# Deploy to Ethereum Sepolia testnet
forge script script/DeployTestnet.s.sol --rpc-url $RPC_URL_SEPOLIA --broadcast --verify
```

### Mainnet Deployment
```bash
# Deploy to Base mainnet
npm run deploy:base

# Deploy to Ethereum mainnet
forge script script/Deploy.s.sol --rpc-url $RPC_URL_MAINNET --broadcast --verify
```

### Base Deployment Scripts
The project includes dedicated Base deployment scripts:
- `script/DeployBase.s.sol`: Main deployment script for Base networks
- `npm run deploy:base-sepolia`: Deploy to Base Sepolia testnet
- `npm run deploy:base`: Deploy to Base mainnet

### Mock Token Deployment
For testing and development, you can deploy and mint mock tokens:

```bash
# Deploy MockERC20 to Base Sepolia
npm run deploy:mock:base-sepolia

# Mint 1000 tUSD tokens to your wallet
npm run mint:mock:base-sepolia
```

**Important**: After deploying the mock token, update your `.env` file with the deployed `PREMIUM_TOKEN` address:
```bash
# Add to your .env file
PREMIUM_TOKEN=0x...  # Address from deploy:mock:base-sepolia output
WALLET_ADDRESS=0x... # Your wallet address for minting
```

**Note**: Make sure your Alchemy app has Base networks enabled. If you get a 403 error, visit your Alchemy dashboard to enable Base and Base Sepolia networks.

## Monitoring

The monitoring bot continuously watches for:
- Liquidity removal events
- Large holder exits
- Suspicious transaction patterns
- Price manipulation attempts

### Adding Tokens to Monitor
```typescript
import { MonitoringService } from '@rug-pull-insurance/shared';

const monitoringService = new MonitoringService();
await monitoringService.addMonitoredToken(8453, '0x...'); // Chain ID 8453 = Base
await monitoringService.addMonitoredToken(1, '0x...');    // Chain ID 1 = Ethereum
```

### Alert Configuration
Configure alerts through environment variables:
- `ALERT_WEBHOOK_URL`: Slack/Discord webhook URL
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_CHAT_ID`: Telegram chat ID
- `ALERT_EMAIL`: Email address for alerts

## Testing

### Smart Contract Tests
```bash
# Run all tests
forge test

# Run specific test
forge test --match-test testCreatePolicy

# Run tests with gas reporting
forge test --gas-report
```

### Bot Tests
```bash
cd bot
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Security

This is experimental software. Use at your own risk. Always audit smart contracts before deploying to mainnet.

## Support

For questions and support, please open an issue on GitHub.

