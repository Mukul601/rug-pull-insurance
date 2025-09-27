// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/RugPullInsurance.sol";
import "../contracts/MockERC20.sol";

contract RugPullInsuranceTest is Test {
    RugPullInsurance public insurance;
    MockERC20 public paymentToken;
    MockERC20 public testToken;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18;
    uint256 public constant COVERAGE_AMOUNT = 1000 * 10**18;
    uint256 public constant POLICY_DURATION = 30 days;

    function setUp() public {
        // Deploy mock tokens
        paymentToken = new MockERC20("Payment Token", "PAY", 18, INITIAL_SUPPLY);
        testToken = new MockERC20("Test Token", "TEST", 18, INITIAL_SUPPLY);
        
        // Deploy insurance contract
        vm.prank(owner);
        insurance = new RugPullInsurance(address(paymentToken));
        
        // Transfer tokens to users
        paymentToken.transfer(user1, 10000 * 10**18);
        paymentToken.transfer(user2, 10000 * 10**18);
        testToken.transfer(user1, 1000 * 10**18);
        testToken.transfer(user2, 1000 * 10**18);
        
        // Approve insurance contract to spend tokens
        vm.prank(user1);
        paymentToken.approve(address(insurance), type(uint256).max);
        
        vm.prank(user2);
        paymentToken.approve(address(insurance), type(uint256).max);
    }

    function testCreatePolicy() public {
        vm.prank(user1);
        bytes32 policyId = insurance.createPolicy(
            address(testToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION
        );
        
        assertTrue(policyId != bytes32(0));
        
        // Check policy details
        (,, address tokenAddress, uint256 coverageAmount, uint256 premium, uint256 expiryTime, bool isActive, bool hasClaimed, uint256 createdAt) = insurance.policies(policyId);
        
        assertEq(tokenAddress, address(testToken));
        assertEq(coverageAmount, COVERAGE_AMOUNT);
        assertTrue(premium > 0);
        assertTrue(expiryTime > block.timestamp);
        assertTrue(isActive);
        assertFalse(hasClaimed);
        assertEq(createdAt, block.timestamp);
    }

    function testCreatePolicyInvalidInputs() public {
        // Test with zero token address
        vm.prank(user1);
        vm.expectRevert("Invalid token address");
        insurance.createPolicy(address(0), COVERAGE_AMOUNT, POLICY_DURATION);
        
        // Test with zero coverage amount
        vm.prank(user1);
        vm.expectRevert("Coverage amount must be positive");
        insurance.createPolicy(address(testToken), 0, POLICY_DURATION);
        
        // Test with zero duration
        vm.prank(user1);
        vm.expectRevert("Duration must be positive");
        insurance.createPolicy(address(testToken), COVERAGE_AMOUNT, 0);
        
        // Test with too long duration
        vm.prank(user1);
        vm.expectRevert("Duration too long");
        insurance.createPolicy(address(testToken), COVERAGE_AMOUNT, 400 days);
    }

    function testCancelPolicy() public {
        // Create policy
        vm.prank(user1);
        bytes32 policyId = insurance.createPolicy(
            address(testToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION
        );
        
        uint256 userBalanceBefore = paymentToken.balanceOf(user1);
        
        // Cancel policy
        vm.prank(user1);
        insurance.cancelPolicy(policyId);
        
        // Check that policy is inactive
        (,,,,,, bool isActive,,) = insurance.policies(policyId);
        assertFalse(isActive);
        
        // Check that user received partial refund
        uint256 userBalanceAfter = paymentToken.balanceOf(user1);
        assertTrue(userBalanceAfter > userBalanceBefore);
    }

    function testFileClaim() public {
        // Create policy
        vm.prank(user1);
        bytes32 policyId = insurance.createPolicy(
            address(testToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION
        );
        
        // File claim
        vm.prank(user1);
        insurance.fileClaim(policyId, "Rug pull detected");
        
        // Check that claim was filed
        (,,,,,,, bool hasClaimed,) = insurance.policies(policyId);
        assertFalse(hasClaimed); // hasClaimed is only set when claim is approved/denied
    }

    function testApproveClaim() public {
        // Create policy
        vm.prank(user1);
        bytes32 policyId = insurance.createPolicy(
            address(testToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION
        );
        
        // File claim
        vm.prank(user1);
        insurance.fileClaim(policyId, "Rug pull detected");
        
        uint256 userBalanceBefore = paymentToken.balanceOf(user1);
        
        // Approve claim
        vm.prank(owner);
        insurance.approveClaim(policyId, COVERAGE_AMOUNT);
        
        // Check that user received payout
        uint256 userBalanceAfter = paymentToken.balanceOf(user1);
        assertEq(userBalanceAfter, userBalanceBefore + COVERAGE_AMOUNT);
        
        // Check that policy is no longer active
        (,,,,,, bool isActive, bool hasClaimed,) = insurance.policies(policyId);
        assertFalse(isActive);
        assertTrue(hasClaimed);
    }

    function testRecordRugPull() public {
        // Record rug pull
        vm.prank(owner);
        insurance.recordRugPull(address(testToken), "Liquidity removed");
        
        // Check that rug pull was recorded
        RugPullInsurance.RugPullEvent[] memory rugPulls = insurance.getTokenRugPulls(address(testToken));
        assertEq(rugPulls.length, 1);
        assertEq(rugPulls[0].tokenAddress, address(testToken));
        assertEq(rugPulls[0].description, "Liquidity removed");
        assertTrue(rugPulls[0].isVerified);
    }

    function testSetPremiumRate() public {
        uint256 newRate = 200; // 2%
        
        vm.prank(owner);
        insurance.setPremiumRate(newRate);
        
        // Test that new rate is applied
        vm.prank(user1);
        bytes32 policyId = insurance.createPolicy(
            address(testToken),
            COVERAGE_AMOUNT,
            POLICY_DURATION
        );
        
        (,,,, uint256 premium,,,,) = insurance.policies(policyId);
        uint256 expectedPremium = (COVERAGE_AMOUNT * newRate) / 10000;
        assertEq(premium, expectedPremium);
    }

    function testWithdraw() public {
        // Create a policy to add funds to contract
        vm.prank(user1);
        insurance.createPolicy(address(testToken), COVERAGE_AMOUNT, POLICY_DURATION);
        
        uint256 contractBalance = paymentToken.balanceOf(address(insurance));
        uint256 ownerBalanceBefore = paymentToken.balanceOf(owner);
        
        // Withdraw funds
        vm.prank(owner);
        insurance.withdraw(contractBalance);
        
        // Check that owner received funds
        uint256 ownerBalanceAfter = paymentToken.balanceOf(owner);
        assertEq(ownerBalanceAfter, ownerBalanceBefore + contractBalance);
    }
}

