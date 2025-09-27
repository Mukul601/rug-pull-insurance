# CoverageManager Deployment Guide

This guide explains how to deploy the CoverageManager contract with Pyth integration.

## Prerequisites

1. **Foundry** - Install from [getfoundry.sh](https://getfoundry.sh/)
2. **Environment Variables** - Set up your deployment environment
3. **Pyth Contract** - Deploy or get address of Pyth contract on your target network

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Required for deployment
PRIVATE_KEY=your_private_key_here
PYTH_CONTRACT=0x...  # Pyth contract address on your network
RPC_URL=your_rpc_url_here

# Optional for verification
ETHERSCAN_API_KEY=your_etherscan_api_key_here
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
ARBISCAN_API_KEY=your_arbiscan_api_key_here
OPTIMISTIC_ETHERSCAN_API_KEY=your_optimistic_etherscan_api_key_here

# For testnet deployment
PRIVATE_KEY_TEST=your_test_private_key_here
```

## Deployment Scripts

### 1. Mainnet Deployment (with real Pyth)

```bash
# Deploy to mainnet
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify

# Or with specific network
forge script script/Deploy.s.sol --rpc-url $RPC_URL_MAINNET --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
```

### 2. Testnet Deployment (with mock Pyth)

```bash
# Deploy to testnet with mock Pyth
forge script script/DeployTestnet.s.sol --rpc-url $RPC_URL_SEPOLIA --broadcast

# Or with specific testnet
forge script script/DeployTestnet.s.sol --rpc-url $RPC_URL_SEPOLIA --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
```

### 3. Comprehensive Deployment (with detailed logging)

```bash
# Deploy with comprehensive setup
forge script script/DeployCoverageManager.s.sol --rpc-url $RPC_URL --broadcast --verify
```

## Network-Specific Commands

### Ethereum Mainnet
```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL_MAINNET --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
```

### Polygon
```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL_POLYGON --broadcast --verify --etherscan-api-key $POLYGONSCAN_API_KEY
```

### Arbitrum
```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL_ARBITRUM --broadcast --verify --etherscan-api-key $ARBISCAN_API_KEY
```

### Optimism
```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL_OPTIMISM --broadcast --verify --etherscan-api-key $OPTIMISTIC_ETHERSCAN_API_KEY
```

### Sepolia Testnet
```bash
forge script script/DeployTestnet.s.sol --rpc-url $RPC_URL_SEPOLIA --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
```

## Post-Deployment Setup

After deployment, you'll need to:

1. **Add Token Support**
```bash
# Add support for a new token
cast send $COVERAGE_MANAGER "setTokenSupport(address,bool)" $TOKEN_ADDRESS true --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

2. **Add Price ID Support**
```bash
# Add support for a new price ID
cast send $COVERAGE_MANAGER "setPriceIdSupport(bytes32,bool)" $PRICE_ID true --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

3. **Configure Drawdown Thresholds**
```bash
# Set drawdown thresholds (20% max, 10% alert)
cast send $COVERAGE_MANAGER "setDrawdownThresholds(uint256,uint256)" 2000 1000 --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

4. **Set Premium Rate**
```bash
# Set premium rate (1% = 100 basis points)
cast send $COVERAGE_MANAGER "setPremiumRate(uint256)" 100 --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

## Testing the Deployment

### 1. Buy a Policy
```bash
# Buy a policy for 1000 USDC coverage for 30 days
cast send $COVERAGE_MANAGER "buyPolicy(address,uint256,uint256,bytes32)" \
  $PAYMENT_TOKEN 1000000000 2592000 $ETH_USD_PRICE_ID \
  --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

### 2. Check Token Drawdown
```bash
# Check if token has significant drawdown
cast call $COVERAGE_MANAGER "checkTokenDrawdown(address,bytes32,bytes32)" \
  $TOKEN_ADDRESS $CURRENT_PRICE_ID $REFERENCE_PRICE_ID
```

### 3. Get Normalized Price
```bash
# Get normalized price for a token
cast call $COVERAGE_MANAGER "getNormalizedPrice(bytes32)" $PRICE_ID
```

### 4. File a Claim
```bash
# File a claim for a policy
cast send $COVERAGE_MANAGER "checkClaim(bytes32,string,uint256)" \
  $POLICY_ID "Rug pull detected" 1000000000 \
  --private-key $PRIVATE_KEY --rpc-url $RPC_URL
```

## Pyth Integration

### Real Pyth Contract Addresses

- **Ethereum Mainnet**: `0x4305FB66699C3B2702D4d05CF1b3043e0CA0a3cF`
- **Polygon**: `0xff1a0f4744e8582DF1aE09D5619b88840768E74e`
- **Arbitrum**: `0xff1a0f4744e8582DF1aE09D5619b88840768E74e`
- **Optimism**: `0xff1a0f4744e8582DF1aE09D5619b88840768E74e`

### Common Price IDs

- **ETH/USD**: `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`
- **BTC/USD**: `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`
- **MATIC/USD**: `0x5de33a9112c2b690b95bdb69a4ecc8c406defeb9defc4b6658fd88eac2bac8a6`

## Verification

After deployment, verify the contract:

```bash
# Verify CoverageManager
forge verify-contract $COVERAGE_MANAGER CoverageManager \
  --chain-id $CHAIN_ID \
  --constructor-args $(cast abi-encode 'constructor(address,address)' $PYTH_CONTRACT $PAYMENT_TOKEN) \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

## Troubleshooting

### Common Issues

1. **"PYTH_CONTRACT not set"**
   - Make sure to set the `PYTH_CONTRACT` environment variable
   - Use the correct Pyth contract address for your network

2. **"Insufficient funds"**
   - Ensure your account has enough ETH for gas fees
   - Check that you have enough tokens for initial liquidity

3. **"Price feed not found"**
   - Make sure the price ID is supported
   - Check that the Pyth contract is properly configured

4. **"Price too old"**
   - Update the price feeds using `updatePriceFeeds`
   - Check the `maxPriceAge` setting

### Getting Help

- Check the deployment logs in `deployment-addresses.txt`
- Verify contract state using `cast call` commands
- Check Pyth documentation for price feed updates

## Security Considerations

1. **Private Keys**: Never commit private keys to version control
2. **Environment Variables**: Use `.env` files and add them to `.gitignore`
3. **Contract Verification**: Always verify contracts after deployment
4. **Testing**: Test thoroughly on testnets before mainnet deployment
5. **Access Control**: Review and configure access controls properly

## Monitoring

After deployment, monitor:

1. **Contract Events**: Watch for policy creation, claims, and price updates
2. **Price Feeds**: Ensure Pyth prices are updating regularly
3. **Liquidity**: Monitor contract balance and ensure sufficient funds
4. **Claims**: Track claim patterns and approval rates
