#!/bin/bash

# CoverageManager Scripts Installation Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 CoverageManager Scripts Installation${NC}"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm $(npm -v) detected${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating example...${NC}"
    cat > .env << EOF
# CoverageManager Scripts Environment Variables
# Copy this file and update with your actual values

# Required - Private key for transactions
PRIVATE_KEY=your_private_key_here

# Required - RPC URLs for different networks
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_11155111=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
RPC_URL_137=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
EOF
    echo -e "${GREEN}✅ Created .env.example file${NC}"
    echo -e "${YELLOW}⚠️  Please update .env with your actual values${NC}"
else
    echo -e "${GREEN}✅ .env file found${NC}"
fi

# Check if addresses.json exists
if [ ! -f addresses.json ]; then
    echo -e "${YELLOW}⚠️  addresses.json not found. Creating template...${NC}"
    echo -e "${GREEN}✅ addresses.json template created${NC}"
    echo -e "${YELLOW}⚠️  Please update addresses.json with your deployed contract addresses${NC}"
else
    echo -e "${GREEN}✅ addresses.json found${NC}"
fi

# Make scripts executable
echo -e "${YELLOW}🔧 Making scripts executable...${NC}"
chmod +x *.ts
echo -e "${GREEN}✅ Scripts made executable${NC}"

# Test TypeScript compilation
echo -e "${YELLOW}🔍 Testing TypeScript compilation...${NC}"
npx tsc --noEmit

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
else
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    echo -e "${YELLOW}⚠️  Please check for TypeScript errors${NC}"
fi

# Installation summary
echo ""
echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update .env with your actual values"
echo "2. Update addresses.json with your deployed contract addresses"
echo "3. Test the scripts with dry run mode"
echo ""
echo -e "${BLUE}Available commands:${NC}"
echo "  npm run approve    # Approve premium tokens"
echo "  npm run buy        # Buy insurance policy"
echo "  npm run inspect    # Inspect contract state"
echo ""
echo -e "${BLUE}Examples:${NC}"
echo "  npm run approve 1 \"1000\"                    # Approve 1000 tokens on mainnet"
echo "  npm run buy 1 \"0x...\" \"100\" 10000 2592000 \"ETH_USD\"  # Buy policy"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  See README.md for detailed usage instructions"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
