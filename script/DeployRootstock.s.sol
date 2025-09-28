// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/CoverageManager.sol";
import "../contracts/MockERC20.sol";

contract DeployRootstockScript is Script {
    function run() external {
        // Get deployer private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get Pyth contract address from environment variable
        address pythContract = vm.envAddress("PYTH_CONTRACT");
        
        console.log("Deploying CoverageManager to Rootstock with account:", deployer);
        console.log("Account balance:", deployer.balance);
        console.log("Pyth contract address:", pythContract);
        console.log("Chain ID:", block.chainid);
        
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
        
        // Set up Rootstock-specific price IDs
        bytes32 ethUsdPriceId = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
        bytes32 btcUsdPriceId = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
        bytes32 rbtcUsdPriceId = keccak256("RBTC/USD"); // Placeholder for RBTC price ID
        
        coverageManager.setPriceIdSupport(ethUsdPriceId, true);
        coverageManager.setPriceIdSupport(btcUsdPriceId, true);
        coverageManager.setPriceIdSupport(rbtcUsdPriceId, true);
        
        // Transfer initial liquidity
        paymentToken.transfer(address(coverageManager), 1000000 * 10**6); // 1M USDC
        
        // Set configuration
        coverageManager.setPremiumRate(100); // 1%
        coverageManager.setDrawdownThresholds(2000, 1000); // 20% max, 10% alert
        coverageManager.setPriceFeedParams(3600, 1000); // 1 hour max age, 1000 min confidence
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== Rootstock Deployment Summary ===");
        console.log("Payment Token (USDC):", address(paymentToken));
        console.log("Pyth Contract:", pythContract);
        console.log("CoverageManager:", address(coverageManager));
        console.log("Deployer:", deployer);
        console.log("Network: Rootstock Mainnet (Chain ID 30)");
        
        // Save addresses to file
        string memory addresses = string(abi.encodePacked(
            "ROOTSTOCK_PAYMENT_TOKEN=", vm.toString(address(paymentToken)), "\n",
            "ROOTSTOCK_PYTH_CONTRACT=", vm.toString(pythContract), "\n",
            "ROOTSTOCK_COVERAGE_MANAGER=", vm.toString(address(coverageManager)), "\n",
            "ROOTSTOCK_DEPLOYER=", vm.toString(deployer), "\n",
            "ROOTSTOCK_CHAIN_ID=30\n"
        ));
        
        vm.writeFile("rootstock-deployment-addresses.txt", addresses);
        console.log("\nRootstock deployment addresses saved to rootstock-deployment-addresses.txt");
    }
}
