// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/mocks/MockERC20.sol";

/**
 * @title DeployMockERC20Script
 * @dev Script to deploy MockERC20 token
 */
contract DeployMockERC20Script is Script {
    function run() external {
        // Get the deployer's private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying MockERC20...");
        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance);
        
        // Get token parameters from environment or use defaults
        string memory name = "Mock USDC";
        string memory symbol = "mUSDC";
        
        // Try to get from environment variables
        try vm.envString("TOKEN_NAME") returns (string memory envName) {
            name = envName;
        } catch {
            // Use default
        }
        
        try vm.envString("TOKEN_SYMBOL") returns (string memory envSymbol) {
            symbol = envSymbol;
        } catch {
            // Use default
        }
        
        console.log("Token name:", name);
        console.log("Token symbol:", symbol);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy MockERC20
        MockERC20 mockToken = new MockERC20(
            name,
            symbol,
            deployer
        );
        
        vm.stopBroadcast();
        
        console.log("MockERC20 deployed at:", address(mockToken));
        console.log("Token name:", mockToken.name());
        console.log("Token symbol:", mockToken.symbol());
        console.log("Token decimals:", mockToken.decimals());
        console.log("Initial supply:", mockToken.totalSupply());
        console.log("Initial supply (tokens):", mockToken.getTokenAmount(mockToken.totalSupply()));
        console.log("Deployer balance:", mockToken.balanceOf(deployer));
        console.log("Deployer balance (tokens):", mockToken.getTokenAmount(mockToken.balanceOf(deployer)));
        
        // Save the deployment info
        string memory deploymentInfo = string(abi.encodePacked(
            "MockERC20 deployed at: ",
            vm.toString(address(mockToken)),
            "\nToken name: ",
            mockToken.name(),
            "\nToken symbol: ",
            mockToken.symbol(),
            "\nToken decimals: ",
            vm.toString(mockToken.decimals()),
            "\nInitial supply: ",
            vm.toString(mockToken.totalSupply()),
            "\nDeployer: ",
            vm.toString(deployer)
        ));
        
        vm.writeFile("deployments/mock-erc20.txt", deploymentInfo);
        console.log("Deployment info saved to deployments/mock-erc20.txt");
        
        console.log("MockERC20 deployment successful!");
    }
}
