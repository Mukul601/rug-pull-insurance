// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/CoverageManager.sol";
import "../contracts/MockERC20.sol";
import "../contracts/MockPyth.sol";

contract CoverageManagerTest is Test {
    CoverageManager public coverageManager;
    MockERC20 public paymentToken;
    MockPyth public pyth;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18;
    uint256 public constant COVERAGE_AMOUNT = 1000 * 10**18;
    uint256 public constant POLICY_DURATION = 30 days;
    bytes32 public constant PRICE_ID = keccak256("ETH/USD");

    function setUp() public {
        // Deploy mock contracts
        paymentToken = new MockERC20("Payment Token", "PAY", 18, INITIAL_SUPPLY);
        pyth = new MockPyth();
        
        // Deploy coverage manager
        vm.prank(owner);
        coverageManager = new CoverageManager(address(pyth), address(paymentToken));
        
        // Set up test environment
        paymentToken.transfer(user1, 10000 * 10**18);
        paymentToken.transfer(user2, 10000 * 10**18);
        
        // Approve coverage manager to spend tokens
        vm.prank(user1);
        paymentToken.approve(address(coverageManager), type(uint256).max);
        
        vm.prank(user2);
        paymentToken.approve(address(coverageManager), type(uint256).max);
        
        // Set up supported token and price ID
        vm.prank(owner);
        coverageManager.setTokenSupport(address(paymentToken), true);
        
        vm.prank(owner);
        coverageManager.setPriceIdSupport(PRICE_ID, true);
        
        // Set up mock price in Pyth
        pyth.setPrice(PRICE_ID, 2000 * 10**8, 1000, -8, block.timestamp);
    }

    function testBuyPolicy() public {
        vm.prank(user1);
        bytes32 policyId = coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            PRICE_ID
        );
        
        assertTrue(policyId != bytes32(0));
        
        // Check policy details
        CoverageManager.Policy memory policy = coverageManager.getPolicy(policyId);
        assertEq(policy.policyHolder, user1);
        assertEq(policy.tokenAddress, address(paymentToken));
        assertEq(policy.coverageAmount, COVERAGE_AMOUNT);
        assertTrue(policy.premium > 0);
        assertTrue(policy.expiryTime > block.timestamp);
        assertTrue(policy.isActive);
        assertEq(uint8(policy.status), uint8(CoverageManager.PolicyStatus.Active));
    }

    function testBuyPolicyInvalidInputs() public {
        // Test with zero token address
        vm.prank(user1);
        vm.expectRevert(CoverageManager.InvalidTokenAddress.selector);
        coverageManager.buyPolicy(address(0), COVERAGE_AMOUNT, POLICY_DURATION, PRICE_ID);
        
        // Test with unsupported token
        vm.prank(user1);
        vm.expectRevert(CoverageManager.UnsupportedToken.selector);
        coverageManager.buyPolicy(address(0x123), COVERAGE_AMOUNT, POLICY_DURATION, PRICE_ID);
        
        // Test with zero coverage amount
        vm.prank(user1);
        vm.expectRevert(CoverageManager.InvalidCoverageAmount.selector);
        coverageManager.buyPolicy(address(paymentToken), 0, POLICY_DURATION, PRICE_ID);
        
        // Test with invalid duration
        vm.prank(user1);
        vm.expectRevert(CoverageManager.InvalidDuration.selector);
        coverageManager.buyPolicy(address(paymentToken), COVERAGE_AMOUNT, 0, PRICE_ID);
        
        // Test with invalid price ID
        vm.prank(user1);
        vm.expectRevert(CoverageManager.InvalidPriceId.selector);
        coverageManager.buyPolicy(address(paymentToken), COVERAGE_AMOUNT, POLICY_DURATION, keccak256("INVALID"));
    }

    function testCancelPolicy() public {
        // Create policy
        vm.prank(user1);
        bytes32 policyId = coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            PRICE_ID
        );
        
        uint256 userBalanceBefore = paymentToken.balanceOf(user1);
        
        // Cancel policy
        vm.prank(user1);
        coverageManager.cancelPolicy(policyId);
        
        // Check that policy is cancelled
        CoverageManager.Policy memory policy = coverageManager.getPolicy(policyId);
        assertFalse(policy.isActive);
        assertEq(uint8(policy.status), uint8(CoverageManager.PolicyStatus.Cancelled));
        
        // Check that user received partial refund
        uint256 userBalanceAfter = paymentToken.balanceOf(user1);
        assertTrue(userBalanceAfter > userBalanceBefore);
    }

    function testUpdatePriceFeeds() public {
        // Create mock price update data
        bytes[] memory priceUpdateData = new bytes[](1);
        priceUpdateData[0] = abi.encode(PRICE_ID, 2100 * 10**8, 1000, -8, block.timestamp);
        
        // Update price feeds
        vm.prank(owner);
        coverageManager.updatePriceFeeds{value: 0.1 ether}(priceUpdateData);
        
        // Verify price was updated
        CoverageManager.PriceInfo memory priceInfo = coverageManager.getLatestPrice(PRICE_ID);
        assertEq(priceInfo.price, 2100 * 10**8);
    }

    function testCheckClaim() public {
        // Create policy
        vm.prank(user1);
        bytes32 policyId = coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            PRICE_ID
        );
        
        // File claim
        vm.prank(user1);
        coverageManager.checkClaim(policyId, "Rug pull detected", COVERAGE_AMOUNT);
        
        // Check that claim was filed
        bytes32[] memory pendingClaims = coverageManager.getPendingClaims();
        assertEq(pendingClaims.length, 1);
        
        CoverageManager.ClaimRequest memory claim = coverageManager.getClaim(pendingClaims[0]);
        assertEq(claim.policyId, policyId);
        assertEq(claim.claimant, user1);
        assertEq(claim.requestedAmount, COVERAGE_AMOUNT);
        assertEq(uint8(claim.status), uint8(CoverageManager.ClaimStatus.Pending));
    }

    function testSettleClaim() public {
        // Create policy
        vm.prank(user1);
        bytes32 policyId = coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            PRICE_ID
        );
        
        // File claim
        vm.prank(user1);
        coverageManager.checkClaim(policyId, "Rug pull detected", COVERAGE_AMOUNT);
        
        bytes32[] memory pendingClaims = coverageManager.getPendingClaims();
        bytes32 claimId = pendingClaims[0];
        
        uint256 userBalanceBefore = paymentToken.balanceOf(user1);
        
        // Approve claim
        vm.prank(owner);
        coverageManager.settleClaim(claimId, true, COVERAGE_AMOUNT, "Approved");
        
        // Check that user received payout
        uint256 userBalanceAfter = paymentToken.balanceOf(user1);
        assertEq(userBalanceAfter, userBalanceBefore + COVERAGE_AMOUNT);
        
        // Check that policy is claimed
        CoverageManager.Policy memory policy = coverageManager.getPolicy(policyId);
        assertTrue(policy.hasClaimed);
        assertEq(uint8(policy.status), uint8(CoverageManager.PolicyStatus.Claimed));
        
        // Check that claim is processed
        CoverageManager.ClaimRequest memory claim = coverageManager.getClaim(claimId);
        assertTrue(claim.isProcessed);
        assertEq(uint8(claim.status), uint8(CoverageManager.ClaimStatus.Approved));
    }

    function testSettleClaimDenied() public {
        // Create policy
        vm.prank(user1);
        bytes32 policyId = coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            PRICE_ID
        );
        
        // File claim
        vm.prank(user1);
        coverageManager.checkClaim(policyId, "Rug pull detected", COVERAGE_AMOUNT);
        
        bytes32[] memory pendingClaims = coverageManager.getPendingClaims();
        bytes32 claimId = pendingClaims[0];
        
        // Deny claim
        vm.prank(owner);
        coverageManager.settleClaim(claimId, false, 0, "Insufficient evidence");
        
        // Check that claim is denied
        CoverageManager.ClaimRequest memory claim = coverageManager.getClaim(claimId);
        assertTrue(claim.isProcessed);
        assertEq(uint8(claim.status), uint8(CoverageManager.ClaimStatus.Denied));
    }

    function testSetPremiumRate() public {
        uint256 newRate = 200; // 2%
        
        vm.prank(owner);
        coverageManager.setPremiumRate(newRate);
        
        // Test that new rate is applied
        vm.prank(user1);
        bytes32 policyId = coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            PRICE_ID
        );
        
        CoverageManager.Policy memory policy = coverageManager.getPolicy(policyId);
        // Premium should be higher with 2% rate
        assertTrue(policy.premium > (COVERAGE_AMOUNT * 100) / 10000);
    }

    function testSetTokenSupport() public {
        address newToken = address(0x456);
        
        vm.prank(owner);
        coverageManager.setTokenSupport(newToken, true);
        
        // Test that token is now supported
        vm.prank(user1);
        vm.expectRevert(CoverageManager.InvalidPriceId.selector); // Should fail on price ID, not token
        coverageManager.buyPolicy(newToken, COVERAGE_AMOUNT, POLICY_DURATION, keccak256("INVALID"));
    }

    function testSetPriceIdSupport() public {
        bytes32 newPriceId = keccak256("BTC/USD");
        
        vm.prank(owner);
        coverageManager.setPriceIdSupport(newPriceId, true);
        
        // Set up price in mock Pyth
        pyth.setPrice(newPriceId, 50000 * 10**8, 1000, -8, block.timestamp);
        
        // Test that price ID is now supported
        vm.prank(user1);
        bytes32 policyId = coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            newPriceId
        );
        
        assertTrue(policyId != bytes32(0));
    }

    function testGetStats() public {
        // Create a policy
        vm.prank(user1);
        coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            PRICE_ID
        );
        
        // Get stats
        (
            uint256 totalPolicies,
            uint256 totalCoverage,
            uint256 totalPremiums,
            uint256 totalClaims,
            uint256 contractBalance
        ) = coverageManager.getStats();
        
        assertEq(totalPolicies, 1);
        assertEq(totalCoverage, COVERAGE_AMOUNT);
        assertTrue(totalPremiums > 0);
        assertEq(totalClaims, 0);
        assertTrue(contractBalance > 0);
    }

    function testPauseUnpause() public {
        // Pause contract
        vm.prank(owner);
        coverageManager.pause();
        
        // Should fail to buy policy when paused
        vm.prank(user1);
        vm.expectRevert("Pausable: paused");
        coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            PRICE_ID
        );
        
        // Unpause contract
        vm.prank(owner);
        coverageManager.unpause();
        
        // Should work after unpause
        vm.prank(user1);
        bytes32 policyId = coverageManager.buyPolicy(
            address(paymentToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION,
            PRICE_ID
        );
        
        assertTrue(policyId != bytes32(0));
    }
}
