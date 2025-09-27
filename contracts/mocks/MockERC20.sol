// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @dev A mintable ERC20 token with 6 decimals for testing purposes
 */
contract MockERC20 is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;
    
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        // Mint initial supply to owner (1,000,000 tokens with 6 decimals)
        _mint(initialOwner, 1_000_000 * 10**_DECIMALS);
    }
    
    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }
    
    /**
     * @dev Mint tokens to a specific address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint (in token units, not wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount * 10**_DECIMALS);
    }
    
    /**
     * @dev Mint tokens to a specific address with raw amount (already scaled)
     * @param to The address to mint tokens to
     * @param rawAmount The raw amount of tokens to mint (already scaled by decimals)
     */
    function mintRaw(address to, uint256 rawAmount) external onlyOwner {
        _mint(to, rawAmount);
    }
    
    /**
     * @dev Burn tokens from a specific address
     * @param from The address to burn tokens from
     * @param amount The amount of tokens to burn (in token units, not wei)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount * 10**_DECIMALS);
    }
    
    /**
     * @dev Get the raw amount for a given token amount
     * @param tokenAmount The token amount (in token units)
     * @return The raw amount (scaled by decimals)
     */
    function getRawAmount(uint256 tokenAmount) external pure returns (uint256) {
        return tokenAmount * 10**_DECIMALS;
    }
    
    /**
     * @dev Get the token amount for a given raw amount
     * @param rawAmount The raw amount (scaled by decimals)
     * @return The token amount (in token units)
     */
    function getTokenAmount(uint256 rawAmount) external pure returns (uint256) {
        return rawAmount / 10**_DECIMALS;
    }
}
