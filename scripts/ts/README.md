# CoverageManager TypeScript Scripts

This directory contains TypeScript scripts for interacting with the CoverageManager contract using Viem. These scripts provide a comprehensive interface for managing insurance policies, price feeds, and claim settlements.

## 📁 Scripts Overview

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `seedReserves.ts` | Seed contract with initial liquidity | Transfer tokens, validate balances, dry-run support |
| `fetchPyth.ts` | Fetch and analyze Pyth price data | Price normalization, drawdown checks, stale price detection |
| `pushPriceAndCheck.ts` | Update prices and check conditions | Price updates, threshold checks, drawdown analysis |
| `settle.ts` | Settle insurance claims | Claim approval/rejection, payout management, validation |

## 🚀 Quick Start

### 1. Installation

```bash
cd scripts/ts
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

# Optional
ETHERSCAN_API_KEY=your_etherscan_key
POLYGONSCAN_API_KEY=your_polygonscan_key
ARBISCAN_API_KEY=your_arbiscan_key
OPTIMISTIC_ETHERSCAN_API_KEY=your_optimistic_etherscan_key
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

### 1. Seed Reserves (`seedReserves.ts`)

Transfer tokens to the CoverageManager contract for initial liquidity.

```bash
# Basic usage
npm run seed-reserves 1 "1000000"

# With specific token
npm run seed-reserves 1 "1000000" "0x..."

# Dry run
npm run seed-reserves 1 "1000000" -- --dry-run

# Help
npm run seed-reserves -- --help
```

**Examples:**
```bash
# Transfer 1M USDC to mainnet
ts-node seedReserves.ts 1 "1000000"

# Transfer 100K tokens to sepolia (dry run)
ts-node seedReserves.ts 11155111 "100000" --dry-run

# Transfer to specific token on polygon
ts-node seedReserves.ts 137 "500000" "0xA0b86a33E6441b8c4C8C0e4A0e4A0e4A0e4A0e4A0"
```

### 2. Fetch Pyth Prices (`fetchPyth.ts`)

Fetch and analyze Pyth price data with comprehensive validation.

```bash
# Fetch specific prices
npm run fetch-pyth 1 "ETH_USD,BTC_USD"

# Fetch all supported prices
npm run fetch-pyth 1 "all"

# Check drawdown
npm run fetch-pyth 1 "ETH_USD,BTC_USD" -- --check-drawdown --token-address 0x...

# Use EMA prices
npm run fetch-pyth 1 "ETH_USD" -- --use-ema

# Custom max age
npm run fetch-pyth 1 "ETH_USD" -- --max-age 1800
```

**Examples:**
```bash
# Fetch ETH and BTC prices on mainnet
ts-node fetchPyth.ts 1 "ETH_USD,BTC_USD"

# Fetch all prices on sepolia
ts-node fetchPyth.ts 11155111 "all"

# Check drawdown between ETH and BTC
ts-node fetchPyth.ts 1 "ETH_USD,BTC_USD" --check-drawdown --token-address 0xA0b86a33E6441b8c4C8C0e4A0e4A0e4A0e4A0e4A0

# Use EMA prices with 30-minute max age
ts-node fetchPyth.ts 1 "ETH_USD" --use-ema --max-age 1800
```

### 3. Push Price and Check (`pushPriceAndCheck.ts`)

Update Pyth prices and perform various checks and validations.

```bash
# Update prices
npm run push-price 1 "ETH_USD,BTC_USD"

# Check drawdown
npm run push-price 1 "ETH_USD,BTC_USD" -- --check-drawdown --token-address 0x...

# Check threshold
npm run push-price 1 "ETH_USD" -- --check-threshold --threshold 2000000000000000000

# Dry run
npm run push-price 1 "ETH_USD" -- --dry-run
```

**Examples:**
```bash
# Update ETH and BTC prices
ts-node pushPriceAndCheck.ts 1 "ETH_USD,BTC_USD"

# Update prices and check drawdown
ts-node pushPriceAndCheck.ts 1 "ETH_USD,BTC_USD" --check-drawdown --token-address 0xA0b86a33E6441b8c4C8C0e4A0e4A0e4A0e4A0e4A0

# Update prices and check threshold
ts-node pushPriceAndCheck.ts 1 "ETH_USD" --check-threshold --threshold 2000000000000000000

# Dry run with custom update data
ts-node pushPriceAndCheck.ts 1 "ETH_USD" --update-data "0x123...,0x456..." --dry-run
```

### 4. Settle Claims (`settle.ts`)

Settle insurance claims with approval or rejection.

```bash
# Approve claim
npm run settle 1 "0x123..." true "Rug pull confirmed" --payout-amount "1000"

# Reject claim
npm run settle 1 "0x456..." false "Insufficient evidence"

# Dry run
npm run settle 1 "0x789..." true "Partial payout" --payout-amount "500" --dry-run
```

**Examples:**
```bash
# Approve claim with full payout
ts-node settle.ts 1 "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" true "Rug pull confirmed" --payout-amount "1000"

# Reject claim
ts-node settle.ts 11155111 "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" false "Insufficient evidence"

# Partial payout approval
ts-node settle.ts 1 "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba" true "Partial payout due to market conditions" --payout-amount "500"
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
scripts/ts/
├── addresses.json          # Network configurations and contract addresses
├── utils.ts               # Shared utilities and helper functions
├── seedReserves.ts        # Reserve seeding script
├── fetchPyth.ts          # Pyth price fetching script
├── pushPriceAndCheck.ts  # Price update and validation script
├── settle.ts             # Claim settlement script
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
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

### Adding New Networks

1. Add network configuration to `addresses.json`
2. Add chain configuration to `utils.ts`
3. Update environment variables
4. Test with dry run mode

### Custom Price IDs

Add new price IDs to `addresses.json`:

```json
{
  "networks": {
    "mainnet": {
      "priceIds": {
        "NEW_TOKEN_USD": "0x..."
      }
    }
  }
}
```

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
4. **"Price not found"**: Verify price ID and network support
5. **"Claim not found"**: Check claim ID and network

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
