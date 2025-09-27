// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/CoverageManager.sol";
import "../contracts/MockERC20.sol";

contract DeployCoverageManagerScript is Script {
    function run() external {
        // Get deployer private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get Pyth contract address from environment variable
        address pythContract = vm.envAddress("PYTH_CONTRACT");
        
        console.log("Deploying CoverageManager with account:", deployer);
        console.log("Account balance:", deployer.balance);
        console.log("Pyth contract address:", pythContract);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy payment token (USDC-like token for testing)
        MockERC20 paymentToken = new MockERC20(
            "USD Coin",
            "USDC",
            6,
            10000000 * 10**6 // 10M USDC
        );
        
        console.log("Payment token deployed at:", address(paymentToken));
        
        // Deploy CoverageManager with Pyth contract
        CoverageManager coverageManager = new CoverageManager(
            pythContract,
            address(paymentToken)
        );
        
        console.log("CoverageManager deployed at:", address(coverageManager));
        
        // Set up initial configuration
        coverageManager.setTokenSupport(address(paymentToken), true);
        
        // Set up common price IDs (these would be real Pyth price IDs in production)
        bytes32 ethUsdPriceId = keccak256("ETH/USD");
        bytes32 btcUsdPriceId = keccak256("BTC/USD");
        bytes32 maticUsdPriceId = keccak256("MATIC/USD");
        bytes32 solUsdPriceId = keccak256("SOL/USD");
        bytes32 avaxUsdPriceId = keccak256("AVAX/USD");
        
        coverageManager.setPriceIdSupport(ethUsdPriceId, true);
        coverageManager.setPriceIdSupport(btcUsdPriceId, true);
        coverageManager.setPriceIdSupport(maticUsdPriceId, true);
        coverageManager.setPriceIdSupport(solUsdPriceId, true);
        coverageManager.setPriceIdSupport(avaxUsdPriceId, true);
        
        console.log("Added support for price IDs:");
        console.log("  ETH/USD:", vm.toString(ethUsdPriceId));
        console.log("  BTC/USD:", vm.toString(btcUsdPriceId));
        console.log("  MATIC/USD:", vm.toString(maticUsdPriceId));
        console.log("  SOL/USD:", vm.toString(solUsdPriceId));
        console.log("  AVAX/USD:", vm.toString(avaxUsdPriceId));
        
        // Transfer some tokens to the coverage manager for initial liquidity
        paymentToken.transfer(address(coverageManager), 1000000 * 10**6); // 1M USDC
        
        console.log("Transferred 1M USDC to CoverageManager");
        
        // Set premium rate to 1% for testing
        coverageManager.setPremiumRate(100);
        console.log("Set premium rate to 1%");
        
        // Set drawdown thresholds
        coverageManager.setDrawdownThresholds(2000, 1000); // 20% max, 10% alert
        console.log("Set drawdown thresholds: 20% max, 10% alert");
        
        // Set price feed parameters
        coverageManager.setPriceFeedParams(3600, 1000); // 1 hour max age, 1000 min confidence
        console.log("Set price feed parameters: 1 hour max age, 1000 min confidence");
        
        vm.stopBroadcast();
        
        // Log deployment info
        console.log("\n=== CoverageManager Deployment Summary ===");
        console.log("Payment Token (USDC):", address(paymentToken));
        console.log("Pyth Contract:", pythContract);
        console.log("CoverageManager:", address(coverageManager));
        console.log("Deployer:", deployer);
        console.log("Network:", block.chainid);
        
        // Save addresses to file for easy access
        string memory addresses = string(abi.encodePacked(
            "PAYMENT_TOKEN=", vm.toString(address(paymentToken)), "\n",
            "PYTH_CONTRACT=", vm.toString(pythContract), "\n",
            "COVERAGE_MANAGER=", vm.toString(address(coverageManager)), "\n",
            "DEPLOYER=", vm.toString(deployer), "\n",
            "CHAIN_ID=", vm.toString(block.chainid), "\n",
            "ETH_USD_PRICE_ID=", vm.toString(ethUsdPriceId), "\n",
            "BTC_USD_PRICE_ID=", vm.toString(btcUsdPriceId), "\n",
            "MATIC_USD_PRICE_ID=", vm.toString(maticUsdPriceId), "\n",
            "SOL_USD_PRICE_ID=", vm.toString(solUsdPriceId), "\n",
            "AVAX_USD_PRICE_ID=", vm.toString(avaxUsdPriceId), "\n"
        ));
        
        vm.writeFile("coverage-manager-deployment.txt", addresses);
        console.log("\nDeployment addresses saved to coverage-manager-deployment.txt");
        
        // Log usage instructions
        console.log("\n=== Usage Instructions ===");
        console.log("1. To buy a policy:");
        console.log("   coverageManager.buyPolicy(tokenAddress, coverageAmount, duration, priceId)");
        console.log("2. To update price feeds:");
        console.log("   coverageManager.updatePriceFeeds{value: fee}(priceUpdateData)");
        console.log("3. To file a claim:");
        console.log("   coverageManager.checkClaim(policyId, reason, requestedAmount)");
        console.log("4. To settle a claim:");
        console.log("   coverageManager.settleClaim(claimId, approved, payoutAmount, reason)");
        console.log("5. To check token drawdown:");
        console.log("   coverageManager.checkTokenDrawdown(tokenAddress, currentPriceId, referencePriceId)");
        console.log("6. To get normalized price:");
        console.log("   coverageManager.getNormalizedPrice(priceId)");
        
        // Log environment variables needed
        console.log("\n=== Required Environment Variables ===");
        console.log("PRIVATE_KEY=your_private_key_here");
        console.log("PYTH_CONTRACT=0x...");
        console.log("RPC_URL=your_rpc_url_here");
        console.log("ETHERSCAN_API_KEY=your_etherscan_api_key_here (for verification)");
        
        // Log verification command
        console.log("\n=== Verification Command ===");
        console.log("forge verify-contract");
        console.log("  Contract:", address(coverageManager));
        console.log("  Name: CoverageManager");
        console.log("  Chain ID:", block.chainid);
        console.log("  Constructor Args: $(cast abi-encode 'constructor(address,address)'", pythContract, address(paymentToken), ")");
    }
}