# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Refactor: Base-only deployment, removed Rootstock/others**
  - Removed `script/DeployRootstock.s.sol` deployment script
  - Cleaned up `foundry.toml` to remove Rootstock, Polygon, Arbitrum, and Optimism RPC endpoints
  - Updated `script/addresses.json` to only include Base and Ethereum networks
  - Updated README.md to focus on Base and Ethereum deployment
  - Marked Pyth and MockERC20 as optional components in documentation
  - Streamlined network configuration for Base-first approach

### Added
- Base Mainnet and Base Sepolia testnet support in network configuration
- Base-specific deployment examples in README
- Clear documentation of optional components (Pyth, MockERC20)

### Removed
- Rootstock deployment script and configuration
- Polygon, Arbitrum, and Optimism network configurations
- References to Flow, ENS, and other non-Base networks in documentation

## [1.0.0] - 2024-01-XX

### Added
- Initial release of Rug Pull Insurance system
- CoverageManager smart contract for policy management
- Monitoring bot with real-time token tracking
- Comprehensive test suite
- Multi-network deployment support
- Web UI for policy management
- Shared TypeScript utilities package
