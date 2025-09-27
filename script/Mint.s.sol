// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/mocks/MockERC20.sol";

/**
 * @title MintScript
 * @dev Script to mint MockERC20 tokens to the deployer's wallet
 */
contract MintScript is Script {
    // MockERC20 contract instance
    MockERC20 public mockToken;
    
    // Amount to mint (in token units, not wei)
    uint256 public constant MINT_AMOUNT = 10000;
    
    function run() external {
        // Get the deployer's private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        console.log("Deployer balance:", deployer.balance);
        
        // Get the token address from environment or use a default
        address tokenAddress = address(0);
        
        try vm.envAddress("MOCK_TOKEN_ADDRESS") returns (address envTokenAddress) {
            tokenAddress = envTokenAddress;
        } catch {
            // Use default (address(0))
        }
        
        if (tokenAddress == address(0)) {
            console.log("MOCK_TOKEN_ADDRESS not set, deploying new MockERC20...");
            
            vm.startBroadcast(deployerPrivateKey);
            
            // Deploy MockERC20
            mockToken = new MockERC20(
                "Mock USDC",
                "mUSDC", 
                deployer
            );
            
            vm.stopBroadcast();
            
            console.log("MockERC20 deployed at:", address(mockToken));
            console.log("Token name:", mockToken.name());
            console.log("Token symbol:", mockToken.symbol());
            console.log("Token decimals:", mockToken.decimals());
            console.log("Initial supply:", mockToken.totalSupply());
            
        } else {
            console.log("Using existing MockERC20 at:", tokenAddress);
            mockToken = MockERC20(tokenAddress);
            
            console.log("Token name:", mockToken.name());
            console.log("Token symbol:", mockToken.symbol());
            console.log("Token decimals:", mockToken.decimals());
            console.log("Current total supply:", mockToken.totalSupply());
        }
        
        // Check current balance
        uint256 currentBalance = mockToken.balanceOf(deployer);
        console.log("Current balance:", currentBalance);
        console.log("Current balance (tokens):", mockToken.getTokenAmount(currentBalance));
        
        // Mint additional tokens
        console.log("Minting", MINT_AMOUNT, "tokens to", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        mockToken.mint(deployer, MINT_AMOUNT);
        
        vm.stopBroadcast();
        
        // Check new balance
        uint256 newBalance = mockToken.balanceOf(deployer);
        console.log("New balance:", newBalance);
        console.log("New balance (tokens):", mockToken.getTokenAmount(newBalance));
        console.log("Minted amount:", newBalance - currentBalance);
        console.log("Minted amount (tokens):", mockToken.getTokenAmount(newBalance - currentBalance));
        
        // Verify the mint was successful
        require(newBalance > currentBalance, "Minting failed");
        console.log("Minting successful!");
    }
    
    /**
     * @dev Mint tokens to a specific address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint (in token units)
     */
    function mintTo(address to, uint256 amount) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address tokenAddress = address(0);
        
        try vm.envAddress("MOCK_TOKEN_ADDRESS") returns (address envTokenAddress) {
            tokenAddress = envTokenAddress;
        } catch {
            // Use default (address(0))
        }
        
        require(tokenAddress != address(0), "MOCK_TOKEN_ADDRESS not set");
        
        mockToken = MockERC20(tokenAddress);
        
        console.log("Minting", amount, "tokens to", to);
        
        vm.startBroadcast(deployerPrivateKey);
        
        mockToken.mint(to, amount);
        
        vm.stopBroadcast();
        
        uint256 balance = mockToken.balanceOf(to);
        console.log("New balance of", to, ":", balance);
        console.log("New balance (tokens):", mockToken.getTokenAmount(balance));
        console.log("Minting successful!");
    }
}
