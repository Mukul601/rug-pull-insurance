# MockERC20 Deployment Guide

This guide explains how to deploy and use the MockERC20 token for testing purposes.

## Overview

The MockERC20 contract is a mintable ERC20 token with 6 decimals, designed for testing the rug pull insurance system.

### Features

- **6 Decimals**: Unlike standard 18-decimal tokens, this uses 6 decimals (like USDC)
- **Mintable**: Owner can mint new tokens
- **Burnable**: Owner can burn tokens
- **Initial Supply**: 1,000,000 tokens minted to deployer on deployment
- **Utility Functions**: Helper functions for amount conversion

## Contract Details

- **Name**: Mock USDC (configurable)
- **Symbol**: mUSDC (configurable)
- **Decimals**: 6
- **Initial Supply**: 1,000,000 tokens
- **Owner**: Deployer address

## Deployment

### Prerequisites

1. Set up your environment variables in `.env`:
```bash
PRIVATE_KEY=your_private_key_here
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```

2. Optional: Customize token parameters:
```bash
TOKEN_NAME=My Test Token
TOKEN_SYMBOL=MTT
```

### Deploy to Testnet

```bash
# Deploy and verify on testnet
npm run deploy:mock

# Deploy without verification
forge script script/DeployMockERC20.s.sol --rpc-url $RPC_URL --broadcast
```

### Deploy to Local Network

```bash
# Start local node first
anvil

# Deploy to local network
npm run deploy:mock:local
```

## Minting Tokens

### Mint to Deployer

```bash
# Mint 10,000 tokens to deployer
npm run mint

# Mint to local network
npm run mint:local
```

### Mint to Specific Address

```bash
# Mint 5,000 tokens to specific address
npm run mint:to 0x1234567890123456789012345678901234567890 5000
```

### Using Foundry Directly

```bash
# Mint tokens using forge script
forge script script/Mint.s.sol --rpc-url $RPC_URL --broadcast

# Mint to specific address
forge script script/Mint.s.sol:MintScript --sig 'mintTo(address,uint256)' 0x1234567890123456789012345678901234567890 5000 --rpc-url $RPC_URL --broadcast
```

## Contract Functions

### Owner Functions

- `mint(address to, uint256 amount)`: Mint tokens (amount in token units)
- `mintRaw(address to, uint256 rawAmount)`: Mint tokens (amount already scaled)
- `burn(address from, uint256 amount)`: Burn tokens (amount in token units)

### View Functions

- `decimals()`: Returns 6
- `getRawAmount(uint256 tokenAmount)`: Convert token units to raw amount
- `getTokenAmount(uint256 rawAmount)`: Convert raw amount to token units

## Usage Examples

### In Tests

```solidity
// Deploy MockERC20
MockERC20 token = new MockERC20("Test Token", "TEST", deployer);

// Mint 1000 tokens
token.mint(user, 1000);

// Check balance (returns raw amount)
uint256 balance = token.balanceOf(user); // 1000 * 10^6 = 1000000000

// Convert to token units
uint256 tokenBalance = token.getTokenAmount(balance); // 1000
```

### In Scripts

```solidity
// Get token instance
MockERC20 token = MockERC20(tokenAddress);

// Mint tokens
token.mint(recipient, 10000); // Mints 10,000 tokens

// Check balance
uint256 balance = token.balanceOf(recipient);
console.log("Balance (tokens):", token.getTokenAmount(balance));
```

## Environment Variables

Add these to your `.env` file:

```bash
# Required
PRIVATE_KEY=your_private_key_here
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Optional
TOKEN_NAME=Mock USDC
TOKEN_SYMBOL=mUSDC
MOCK_TOKEN_ADDRESS=0x... # Set after deployment
```

## Deployment Output

After deployment, you'll see:

```
MockERC20 deployed at: 0x1234567890123456789012345678901234567890
Token name: Mock USDC
Token symbol: mUSDC
Token decimals: 6
Initial supply: 1000000000000
Initial supply (tokens): 1000000
Deployer balance: 1000000000000
Deployer balance (tokens): 1000000
Deployment info saved to deployments/mock-erc20.txt
✅ MockERC20 deployment successful!
```

## Integration with CoverageManager

To use this token as the premium token in CoverageManager:

1. Deploy MockERC20
2. Set `MOCK_TOKEN_ADDRESS` in your environment
3. Deploy CoverageManager with the MockERC20 address
4. Mint tokens to test users
5. Users can approve and buy policies

## Troubleshooting

### Common Issues

1. **Insufficient funds**: Ensure deployer has enough ETH for gas
2. **Invalid private key**: Check `PRIVATE_KEY` format (no 0x prefix)
3. **RPC issues**: Verify `RPC_URL` is correct and accessible
4. **Verification fails**: Check `ETHERSCAN_API_KEY` is set

### Gas Estimation

Typical gas costs:
- Deployment: ~1,200,000 gas
- Minting: ~50,000 gas
- Burning: ~30,000 gas

## Security Notes

⚠️ **This is a test token only!** Do not use in production:
- Owner can mint unlimited tokens
- No access controls beyond owner
- No pause functionality
- No upgrade mechanism

Use only for testing and development purposes.
