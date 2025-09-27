// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/mocks/MockERC20.sol";

contract MockERC20Test is Test {
    MockERC20 public token;
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    function setUp() public {
        vm.prank(owner);
        token = new MockERC20("Test Token", "TEST", owner);
    }

    function testInitialState() public {
        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TEST");
        assertEq(token.decimals(), 6);
        assertEq(token.totalSupply(), 1_000_000 * 10**6);
        assertEq(token.balanceOf(owner), 1_000_000 * 10**6);
    }

    function testMint() public {
        uint256 mintAmount = 1000; // 1000 tokens
        
        vm.prank(owner);
        token.mint(user1, mintAmount);
        
        assertEq(token.balanceOf(user1), mintAmount * 10**6);
        assertEq(token.getTokenAmount(token.balanceOf(user1)), mintAmount);
    }

    function testMintRaw() public {
        uint256 rawAmount = 500 * 10**6; // 500 tokens in raw format
        
        vm.prank(owner);
        token.mintRaw(user1, rawAmount);
        
        assertEq(token.balanceOf(user1), rawAmount);
        assertEq(token.getTokenAmount(token.balanceOf(user1)), 500);
    }

    function testBurn() public {
        uint256 burnAmount = 100; // 100 tokens
        uint256 initialBalance = token.balanceOf(owner);
        
        vm.prank(owner);
        token.burn(owner, burnAmount);
        
        assertEq(token.balanceOf(owner), initialBalance - (burnAmount * 10**6));
    }

    function testGetRawAmount() public {
        uint256 tokenAmount = 1000;
        uint256 expectedRaw = 1000 * 10**6;
        
        assertEq(token.getRawAmount(tokenAmount), expectedRaw);
    }

    function testGetTokenAmount() public {
        uint256 rawAmount = 1000 * 10**6;
        uint256 expectedToken = 1000;
        
        assertEq(token.getTokenAmount(rawAmount), expectedToken);
    }

    function testTransfer() public {
        uint256 transferAmount = 100 * 10**6; // 100 tokens
        
        vm.prank(owner);
        token.transfer(user1, transferAmount);
        
        assertEq(token.balanceOf(user1), transferAmount);
        assertEq(token.balanceOf(owner), (1_000_000 * 10**6) - transferAmount);
    }

    function testTransferFrom() public {
        uint256 transferAmount = 100 * 10**6; // 100 tokens
        
        // Owner approves user1 to spend tokens
        vm.prank(owner);
        token.approve(user1, transferAmount);
        
        // User1 transfers from owner to user2
        vm.prank(user1);
        token.transferFrom(owner, user2, transferAmount);
        
        assertEq(token.balanceOf(user2), transferAmount);
        assertEq(token.balanceOf(owner), (1_000_000 * 10**6) - transferAmount);
    }

    function testOnlyOwnerCanMint() public {
        vm.prank(user1);
        vm.expectRevert();
        token.mint(user2, 1000);
    }

    function testOnlyOwnerCanBurn() public {
        vm.prank(user1);
        vm.expectRevert();
        token.burn(owner, 100);
    }

    function testMintToZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert();
        token.mint(address(0), 1000);
    }

    function testBurnFromZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert();
        token.burn(address(0), 100);
    }
}
