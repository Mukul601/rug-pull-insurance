#!/bin/bash

# CoverageManager Deployment Script
# This script demonstrates how to deploy the CoverageManager contract

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 CoverageManager Deployment Script${NC}"
echo "=================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create a .env file with the following variables:"
    echo "PRIVATE_KEY=your_private_key_here"
    echo "PYTH_CONTRACT=0x..."
    echo "RPC_URL=your_rpc_url_here"
    echo "ETHERSCAN_API_KEY=your_etherscan_api_key_here"
    exit 1
fi

# Load environment variables
source .env

# Check required environment variables
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ PRIVATE_KEY not set in .env file${NC}"
    exit 1
fi

if [ -z "$PYTH_CONTRACT" ]; then
    echo -e "${RED}❌ PYTH_CONTRACT not set in .env file${NC}"
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    echo -e "${RED}❌ RPC_URL not set in .env file${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo "Pyth Contract: $PYTH_CONTRACT"
echo "RPC URL: $RPC_URL"

# Choose deployment type
echo ""
echo "Select deployment type:"
echo "1) Mainnet (with real Pyth contract)"
echo "2) Testnet (with mock Pyth contract)"
echo "3) Comprehensive deployment (with detailed logging)"
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo -e "${YELLOW}📦 Deploying to mainnet...${NC}"
        forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
        ;;
    2)
        echo -e "${YELLOW}📦 Deploying to testnet with mock Pyth...${NC}"
        forge script script/DeployTestnet.s.sol --rpc-url $RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
        ;;
    3)
        echo -e "${YELLOW}📦 Deploying with comprehensive setup...${NC}"
        forge script script/DeployCoverageManager.s.sol --rpc-url $RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Deployment completed!${NC}"

# Check if deployment addresses file exists
if [ -f "deployment-addresses.txt" ]; then
    echo ""
    echo -e "${GREEN}📄 Deployment addresses saved to deployment-addresses.txt${NC}"
    echo "Contract addresses:"
    cat deployment-addresses.txt
elif [ -f "testnet-deployment-addresses.txt" ]; then
    echo ""
    echo -e "${GREEN}📄 Testnet deployment addresses saved to testnet-deployment-addresses.txt${NC}"
    echo "Contract addresses:"
    cat testnet-deployment-addresses.txt
elif [ -f "coverage-manager-deployment.txt" ]; then
    echo ""
    echo -e "${GREEN}📄 Comprehensive deployment addresses saved to coverage-manager-deployment.txt${NC}"
    echo "Contract addresses:"
    cat coverage-manager-deployment.txt
fi

echo ""
echo -e "${GREEN}🎉 Deployment successful!${NC}"
echo "Next steps:"
echo "1. Review the deployment addresses"
echo "2. Test the contract functions"
echo "3. Monitor the contract events"
echo "4. See DEPLOYMENT.md for detailed usage instructions"
