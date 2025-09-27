// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RugPullInsurance
 * @dev Insurance contract for protecting against rug pulls
 */
contract RugPullInsurance is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Events
    event PolicyCreated(
        bytes32 indexed policyId,
        address indexed policyHolder,
        address indexed tokenAddress,
        uint256 coverageAmount,
        uint256 premium,
        uint256 expiryTime
    );
    
    event PolicyCancelled(bytes32 indexed policyId, address indexed policyHolder);
    event ClaimFiled(bytes32 indexed policyId, address indexed claimant, string reason);
    event ClaimApproved(bytes32 indexed policyId, address indexed claimant, uint256 payout);
    event ClaimDenied(bytes32 indexed policyId, address indexed claimant, string reason);
    event RugPullDetected(address indexed tokenAddress, uint256 blockNumber, string description);

    // Structs
    struct Policy {
        bytes32 id;
        address policyHolder;
        address tokenAddress;
        uint256 coverageAmount;
        uint256 premium;
        uint256 expiryTime;
        bool isActive;
        bool hasClaimed;
        uint256 createdAt;
    }

    struct RugPullEvent {
        address tokenAddress;
        uint256 blockNumber;
        uint256 timestamp;
        string description;
        bool isVerified;
    }

    // State variables
    mapping(bytes32 => Policy) public policies;
    mapping(address => bytes32[]) public userPolicies;
    mapping(address => RugPullEvent[]) public tokenRugPulls;
    
    uint256 public totalPolicies;
    uint256 public totalCoverage;
    uint256 public totalPremiums;
    uint256 public constant MIN_PREMIUM_RATE = 50; // 0.5% (50 basis points)
    uint256 public constant MAX_PREMIUM_RATE = 1000; // 10% (1000 basis points)
    uint256 public premiumRate = 100; // 1% (100 basis points)
    
    IERC20 public immutable paymentToken; // Token used for premiums and payouts

    // Modifiers
    modifier onlyValidPolicy(bytes32 policyId) {
        require(policies[policyId].policyHolder != address(0), "Policy does not exist");
        _;
    }

    modifier onlyPolicyHolder(bytes32 policyId) {
        require(policies[policyId].policyHolder == msg.sender, "Not policy holder");
        _;
    }

    modifier onlyActivePolicy(bytes32 policyId) {
        require(policies[policyId].isActive, "Policy not active");
        _;
    }

    constructor(address _paymentToken) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
    }

    /**
     * @dev Create a new insurance policy
     * @param tokenAddress The address of the token to insure
     * @param coverageAmount The amount of coverage requested
     * @param duration The duration of the policy in seconds
     */
    function createPolicy(
        address tokenAddress,
        uint256 coverageAmount,
        uint256 duration
    ) external nonReentrant returns (bytes32) {
        require(tokenAddress != address(0), "Invalid token address");
        require(coverageAmount > 0, "Coverage amount must be positive");
        require(duration > 0, "Duration must be positive");
        require(duration <= 365 days, "Duration too long");

        // Calculate premium
        uint256 premium = (coverageAmount * premiumRate) / 10000;
        require(premium >= (coverageAmount * MIN_PREMIUM_RATE) / 10000, "Premium too low");
        require(premium <= (coverageAmount * MAX_PREMIUM_RATE) / 10000, "Premium too high");

        // Transfer premium from user
        paymentToken.safeTransferFrom(msg.sender, address(this), premium);

        // Create policy
        bytes32 policyId = keccak256(
            abi.encodePacked(
                msg.sender,
                tokenAddress,
                coverageAmount,
                block.timestamp,
                block.number
            )
        );

        policies[policyId] = Policy({
            id: policyId,
            policyHolder: msg.sender,
            tokenAddress: tokenAddress,
            coverageAmount: coverageAmount,
            premium: premium,
            expiryTime: block.timestamp + duration,
            isActive: true,
            hasClaimed: false,
            createdAt: block.timestamp
        });

        userPolicies[msg.sender].push(policyId);
        totalPolicies++;
        totalCoverage += coverageAmount;
        totalPremiums += premium;

        emit PolicyCreated(
            policyId,
            msg.sender,
            tokenAddress,
            coverageAmount,
            premium,
            block.timestamp + duration
        );

        return policyId;
    }

    /**
     * @dev Cancel an active policy
     * @param policyId The ID of the policy to cancel
     */
    function cancelPolicy(bytes32 policyId) 
        external 
        onlyValidPolicy(policyId)
        onlyPolicyHolder(policyId)
        onlyActivePolicy(policyId)
    {
        Policy storage policy = policies[policyId];
        
        // Calculate refund (proportional to remaining time)
        uint256 timeRemaining = policy.expiryTime - block.timestamp;
        uint256 totalDuration = policy.expiryTime - policy.createdAt;
        uint256 refundAmount = (policy.premium * timeRemaining) / totalDuration;
        
        policy.isActive = false;
        totalCoverage -= policy.coverageAmount;
        totalPremiums -= (policy.premium - refundAmount);
        
        // Refund proportional premium
        if (refundAmount > 0) {
            paymentToken.safeTransfer(policy.policyHolder, refundAmount);
        }
        
        emit PolicyCancelled(policyId, msg.sender);
    }

    /**
     * @dev File a claim for a rug pull
     * @param policyId The ID of the policy
     * @param reason The reason for the claim
     */
    function fileClaim(bytes32 policyId, string calldata reason) 
        external 
        onlyValidPolicy(policyId)
        onlyPolicyHolder(policyId)
        onlyActivePolicy(policyId)
    {
        Policy storage policy = policies[policyId];
        require(!policy.hasClaimed, "Claim already filed");
        require(block.timestamp <= policy.expiryTime, "Policy expired");
        
        emit ClaimFiled(policyId, msg.sender, reason);
    }

    /**
     * @dev Approve a claim (only owner)
     * @param policyId The ID of the policy
     * @param payout The amount to payout
     */
    function approveClaim(bytes32 policyId, uint256 payout) 
        external 
        onlyOwner 
        onlyValidPolicy(policyId)
    {
        Policy storage policy = policies[policyId];
        require(!policy.hasClaimed, "Claim already processed");
        require(payout <= policy.coverageAmount, "Payout exceeds coverage");
        require(payout <= paymentToken.balanceOf(address(this)), "Insufficient funds");
        
        policy.hasClaimed = true;
        policy.isActive = false;
        totalCoverage -= policy.coverageAmount;
        
        paymentToken.safeTransfer(policy.policyHolder, payout);
        
        emit ClaimApproved(policyId, policy.policyHolder, payout);
    }

    /**
     * @dev Deny a claim (only owner)
     * @param policyId The ID of the policy
     * @param reason The reason for denial
     */
    function denyClaim(bytes32 policyId, string calldata reason) 
        external 
        onlyOwner 
        onlyValidPolicy(policyId)
    {
        Policy storage policy = policies[policyId];
        require(!policy.hasClaimed, "Claim already processed");
        
        policy.hasClaimed = true;
        
        emit ClaimDenied(policyId, policy.policyHolder, reason);
    }

    /**
     * @dev Record a rug pull event (only owner)
     * @param tokenAddress The address of the token
     * @param description Description of the rug pull
     */
    function recordRugPull(address tokenAddress, string calldata description) 
        external 
        onlyOwner 
    {
        require(tokenAddress != address(0), "Invalid token address");
        
        RugPullEvent memory rugPull = RugPullEvent({
            tokenAddress: tokenAddress,
            blockNumber: block.number,
            timestamp: block.timestamp,
            description: description,
            isVerified: true
        });
        
        tokenRugPulls[tokenAddress].push(rugPull);
        
        emit RugPullDetected(tokenAddress, block.number, description);
    }

    /**
     * @dev Get user's policies
     * @param user The user's address
     * @return Array of policy IDs
     */
    function getUserPolicies(address user) external view returns (bytes32[] memory) {
        return userPolicies[user];
    }

    /**
     * @dev Get rug pull events for a token
     * @param tokenAddress The token address
     * @return Array of rug pull events
     */
    function getTokenRugPulls(address tokenAddress) external view returns (RugPullEvent[] memory) {
        return tokenRugPulls[tokenAddress];
    }

    /**
     * @dev Set premium rate (only owner)
     * @param newRate The new premium rate in basis points
     */
    function setPremiumRate(uint256 newRate) external onlyOwner {
        require(newRate >= MIN_PREMIUM_RATE && newRate <= MAX_PREMIUM_RATE, "Invalid rate");
        premiumRate = newRate;
    }

    /**
     * @dev Withdraw funds (only owner)
     * @param amount The amount to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= paymentToken.balanceOf(address(this)), "Insufficient balance");
        paymentToken.safeTransfer(owner(), amount);
    }
}

