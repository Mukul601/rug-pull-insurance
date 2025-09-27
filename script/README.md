# CoverageManager Scripts

This directory contains TypeScript scripts for interacting with the CoverageManager contract using Viem.

## 📁 Scripts Overview

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `approvePremium.ts` | Approve premium tokens for CoverageManager | Token approval, balance validation, explorer links |
| `buyPolicy.ts` | Purchase insurance policies | Policy creation, coverage calculation, transaction tracking |
| `inspect.ts` | Inspect contract state and policies | Pool reserves, protocol fees, policy details, token balances |

## 🚀 Quick Start

### 1. Installation

```bash
cd script
npm install
```

### 2. Environment Setup

Create a `.env` file in the project root:

```bash
# Required
PRIVATE_KEY=your_private_key_here
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_11155111=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
RPC_URL_137=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### 3. Update Addresses

Update `addresses.json` with your deployed contract addresses:

```json
{
  "networks": {
    "mainnet": {
      "chainId": 1,
      "coverageManager": "0x...",
      "paymentToken": "0x...",
      "pythContract": "0x4305FB66699C3B2702D4d05CF1b3043e0CA0a3cF"
    }
  }
}
```

## 📋 Script Usage

### 1. Approve Premium (`approvePremium.ts`)

Approve payment tokens for the CoverageManager contract.

```bash
# Basic usage
npm run approve 1 "1000"

# With specific amount
npm run approve 11155111 "500"

# Dry run
npm run approve 1 "1000" -- --dry-run

# Help
npm run approve -- --help
```

**Examples:**
```bash
# Approve 1000 USDC on mainnet
ts-node approvePremium.ts 1 "1000"

# Approve 500 tokens on sepolia (dry run)
ts-node approvePremium.ts 11155111 "500" --dry-run

# Approve 2000 tokens on polygon
ts-node approvePremium.ts 137 "2000"
```

### 2. Buy Policy (`buyPolicy.ts`)

Purchase insurance policies for tokens.

```bash
# Basic usage
npm run buy 1 "0x..." "100" 10000 2592000 "ETH_USD"

# With specific parameters
npm run buy 11155111 "0x..." "50" 5000 86400 "BTC_USD" --dry-run

# Help
npm run buy -- --help
```

**Examples:**
```bash
# Buy policy for ETH token
ts-node buyPolicy.ts 1 "0xA0b86a33E6441b8c4C8C0e4A0e4A0e4A0e4A0e4A0" "100" 10000 2592000 "ETH_USD"

# Buy policy with 50% coverage for 1 day
ts-node buyPolicy.ts 11155111 "0x..." "50" 5000 86400 "BTC_USD" --dry-run

# Buy policy with 150% coverage for 1 week
ts-node buyPolicy.ts 137 "0x..." "200" 15000 604800 "MATIC_USD"
```

### 3. Inspect Contract (`inspect.ts`)

Inspect contract state, pool reserves, protocol fees, and policy details.

```bash
# Basic inspection
npm run inspect 1

# Inspect specific token
npm run inspect 1 -- --token 0x...

# Inspect specific policy
npm run inspect 1 -- --policy 0x...

# Show all supported tokens and price IDs
npm run inspect 1 -- --show-all-tokens --show-all-policies

# Help
npm run inspect -- --help
```

**Examples:**
```bash
# Basic contract inspection
ts-node inspect.ts 1

# Inspect specific token
ts-node inspect.ts 1 --token 0xA0b86a33E6441b8c4C8C0e4A0e4A0e4A0e4A0e4A0

# Inspect specific policy
ts-node inspect.ts 1 --policy 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Show all supported tokens and price IDs
ts-node inspect.ts 1 --show-all-tokens --show-all-policies
```

## 🔧 Configuration

### Supported Networks

| Chain ID | Network | Pyth Contract |
|----------|---------|---------------|
| 1 | Ethereum Mainnet | `0x4305FB66699C3B2702D4d05CF1b3043e0CA0a3cF` |
| 11155111 | Sepolia Testnet | `0x2880aB155794e717c66B316F0aA1B4E0a23D978f` |
| 137 | Polygon | `0xff1a0f4744e8582DF1aE09D5619b88840768E74e` |
| 42161 | Arbitrum | `0xff1a0f4744e8582DF1aE09D5619b88840768E74e` |
| 10 | Optimism | `0xff1a0f4744e8582DF1aE09D5619b88840768E74e` |

### Price IDs

Common price IDs are pre-configured in `addresses.json`:

- **ETH/USD**: `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`
- **BTC/USD**: `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`
- **MATIC/USD**: `0x5de33a9112c2b690b95bdb69a4ecc8c406defeb9defc4b6658fd88eac2bac8a6`
- **SOL/USD**: `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`
- **AVAX/USD**: `0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7`

## 🛠️ Development

### Project Structure

```
script/
├── addresses.json          # Network configurations and contract addresses
├── utils.ts               # Shared utilities and helper functions
├── approvePremium.ts      # Premium approval script
├── buyPolicy.ts           # Policy purchase script
├── inspect.ts             # Contract inspection script
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

### Key Features

1. **Type Safety**: Full TypeScript support with strict type checking
2. **Error Handling**: Comprehensive error handling and validation
3. **Retry Logic**: Automatic retry with exponential backoff
4. **Dry Run Support**: Test operations without executing transactions
5. **Multi-Network**: Support for multiple EVM-compatible networks
6. **Comprehensive Logging**: Detailed logging and status reporting
7. **Gas Optimization**: Efficient gas usage and estimation
8. **Security**: Private key validation and secure transaction handling

## 🔒 Security Considerations

1. **Private Keys**: Never commit private keys to version control
2. **Environment Variables**: Use `.env` files and add to `.gitignore`
3. **Network Validation**: Always validate network configurations
4. **Transaction Confirmation**: Wait for transaction confirmations
5. **Error Handling**: Implement proper error handling and validation
6. **Dry Run**: Always test with dry run mode first

## 🐛 Troubleshooting

### Common Issues

1. **"Network not found"**: Check chain ID and network configuration
2. **"Insufficient balance"**: Ensure account has enough tokens/ETH
3. **"Transaction failed"**: Check gas limits and network congestion
4. **"CoverageManager address not set"**: Update addresses.json
5. **"Payment token address not set"**: Update addresses.json

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=true ts-node scriptName.ts
```

### Gas Issues

If transactions fail due to gas:

1. Check current gas prices
2. Increase gas limit
3. Use gas estimation
4. Retry during low congestion

## 📚 API Reference

### Utility Functions

- `createClients(chainId)`: Create Viem clients
- `getNetworkConfig(chainId)`: Get network configuration
- `loadAddresses()`: Load contract addresses
- `waitForTransaction(hash)`: Wait for transaction confirmation
- `retry(fn, maxRetries, delay)`: Retry function with backoff

### Error Handling

- `handleError(error, context)`: Handle and log errors
- `validateEnvVars(required)`: Validate environment variables
- `logInfo/Success/Warning/Error()`: Logging utilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
