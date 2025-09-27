// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/CoverageManager.sol";
import "../contracts/MockERC20.sol";

contract DeployScript is Script {
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
        
        // Set up common price IDs
        bytes32 ethUsdPriceId = keccak256("ETH/USD");
        bytes32 btcUsdPriceId = keccak256("BTC/USD");
        bytes32 maticUsdPriceId = keccak256("MATIC/USD");
        
        coverageManager.setPriceIdSupport(ethUsdPriceId, true);
        coverageManager.setPriceIdSupport(btcUsdPriceId, true);
        coverageManager.setPriceIdSupport(maticUsdPriceId, true);
        
        // Transfer initial liquidity
        paymentToken.transfer(address(coverageManager), 1000000 * 10**6); // 1M USDC
        
        // Set configuration
        coverageManager.setPremiumRate(100); // 1%
        coverageManager.setDrawdownThresholds(2000, 1000); // 20% max, 10% alert
        coverageManager.setPriceFeedParams(3600, 1000); // 1 hour max age, 1000 min confidence
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Payment Token (USDC):", address(paymentToken));
        console.log("Pyth Contract:", pythContract);
        console.log("CoverageManager:", address(coverageManager));
        console.log("Deployer:", deployer);
        console.log("Network:", block.chainid);
        
        // Save addresses to file
        string memory addresses = string(abi.encodePacked(
            "PAYMENT_TOKEN=", vm.toString(address(paymentToken)), "\n",
            "PYTH_CONTRACT=", vm.toString(pythContract), "\n",
            "COVERAGE_MANAGER=", vm.toString(address(coverageManager)), "\n",
            "DEPLOYER=", vm.toString(deployer), "\n",
            "CHAIN_ID=", vm.toString(block.chainid), "\n"
        ));
        
        vm.writeFile("deployment-addresses.txt", addresses);
        console.log("\nDeployment addresses saved to deployment-addresses.txt");
    }
}