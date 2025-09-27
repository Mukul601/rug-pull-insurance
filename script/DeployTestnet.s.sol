// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/CoverageManager.sol";
import "../contracts/MockERC20.sol";
import "../contracts/MockPyth.sol";

contract DeployTestnetScript is Script {
    function run() external {
        // Get deployer private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_TEST");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying to testnet with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy payment token (USDC-like token for testing)
        MockERC20 paymentToken = new MockERC20(
            "Test USD Coin",
            "tUSDC",
            6,
            10000000 * 10**6 // 10M tUSDC
        );
        
        console.log("Test payment token deployed at:", address(paymentToken));
        
        // Deploy mock Pyth (for testing - in production use real Pyth)
        MockPyth pyth = new MockPyth();
        
        console.log("Mock Pyth deployed at:", address(pyth));
        
        // Deploy CoverageManager
        CoverageManager coverageManager = new CoverageManager(
            address(pyth),
            address(paymentToken)
        );
        
        console.log("CoverageManager deployed at:", address(coverageManager));
        
        // Set up initial configuration
        coverageManager.setTokenSupport(address(paymentToken), true);
        
        // Set up common price IDs
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
        
        // Set up mock prices in Pyth
        pyth.setPrice(ethUsdPriceId, 2000 * 10**8, 1000, -8, block.timestamp);
        pyth.setPrice(btcUsdPriceId, 50000 * 10**8, 1000, -8, block.timestamp);
        pyth.setPrice(maticUsdPriceId, 1 * 10**8, 1000, -8, block.timestamp);
        pyth.setPrice(solUsdPriceId, 100 * 10**8, 1000, -8, block.timestamp);
        pyth.setPrice(avaxUsdPriceId, 25 * 10**8, 1000, -8, block.timestamp);
        
        console.log("Set up mock prices in Pyth");
        
        // Transfer initial liquidity
        paymentToken.transfer(address(coverageManager), 1000000 * 10**6); // 1M tUSDC
        
        console.log("Transferred 1M tUSDC to CoverageManager");
        
        // Set configuration for testnet
        coverageManager.setPremiumRate(50); // 0.5% for testing
        coverageManager.setDrawdownThresholds(1500, 750); // 15% max, 7.5% alert
        coverageManager.setPriceFeedParams(7200, 500); // 2 hours max age, 500 min confidence
        
        console.log("Set testnet configuration");
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Testnet Deployment Summary ===");
        console.log("Payment Token (tUSDC):", address(paymentToken));
        console.log("Mock Pyth:", address(pyth));
        console.log("CoverageManager:", address(coverageManager));
        console.log("Deployer:", deployer);
        console.log("Network:", block.chainid);
        
        // Save addresses to file
        string memory addresses = string(abi.encodePacked(
            "PAYMENT_TOKEN=", vm.toString(address(paymentToken)), "\n",
            "PYTH_CONTRACT=", vm.toString(address(pyth)), "\n",
            "COVERAGE_MANAGER=", vm.toString(address(coverageManager)), "\n",
            "DEPLOYER=", vm.toString(deployer), "\n",
            "CHAIN_ID=", vm.toString(block.chainid), "\n",
            "ETH_USD_PRICE_ID=", vm.toString(ethUsdPriceId), "\n",
            "BTC_USD_PRICE_ID=", vm.toString(btcUsdPriceId), "\n",
            "MATIC_USD_PRICE_ID=", vm.toString(maticUsdPriceId), "\n",
            "SOL_USD_PRICE_ID=", vm.toString(solUsdPriceId), "\n",
            "AVAX_USD_PRICE_ID=", vm.toString(avaxUsdPriceId), "\n"
        ));
        
        vm.writeFile("testnet-deployment-addresses.txt", addresses);
        console.log("\nTestnet deployment addresses saved to testnet-deployment-addresses.txt");
        
        // Log test instructions
        console.log("\n=== Test Instructions ===");
        console.log("1. Test buying a policy with cast send");
        console.log("2. Test checking drawdown with cast call");
        console.log("3. Test getting normalized price with cast call");
        console.log("See DEPLOYMENT.md for detailed commands");
    }
}