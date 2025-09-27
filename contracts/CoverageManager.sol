// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IPyth.sol";
import "./libraries/PriceMath.sol";

/**
 * @title CoverageManager
 * @dev Manages insurance policies with Pyth price feed integration for accurate pricing
 */
contract CoverageManager is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ============ INTERFACES ============
    IPyth public immutable pyth;
    IERC20 public immutable paymentToken;

    // ============ STRUCTS ============
    struct Policy {
        bytes32 id;
        address policyHolder;
        address tokenAddress;
        uint256 coverageAmount;
        uint256 premium;
        uint256 expiryTime;
        uint256 createdAt;
        bool isActive;
        bool hasClaimed;
        PolicyStatus status;
        PriceInfo priceInfo;
    }

    struct PriceInfo {
        bytes32 priceId;
        uint64 priceUpdateTime;
        int64 price;
        uint32 confidence;
        int32 expo;
        uint32 twap;
        uint256 normalizedPrice; // Price normalized to 1e18
    }

    struct ClaimRequest {
        bytes32 policyId;
        address claimant;
        string reason;
        uint256 requestedAmount;
        uint256 submittedAt;
        bool isProcessed;
        ClaimStatus status;
    }

    // ============ ENUMS ============
    enum PolicyStatus {
        Active,
        Expired,
        Cancelled,
        Claimed
    }

    enum ClaimStatus {
        Pending,
        Approved,
        Denied,
        UnderReview
    }

    // ============ STATE VARIABLES ============
    mapping(bytes32 => Policy) public policies;
    mapping(address => bytes32[]) public userPolicies;
    mapping(bytes32 => ClaimRequest) public claims;
    mapping(bytes32 => bool) public supportedPriceIds;
    mapping(address => bool) public supportedTokens;
    
    bytes32[] public allPolicies;
    bytes32[] public pendingClaims;
    
    uint256 public totalPolicies;
    uint256 public totalCoverage;
    uint256 public totalPremiums;
    uint256 public totalClaims;
    
    // Pricing parameters
    uint256 public basePremiumRate = 100; // 1% (100 basis points)
    uint256 public minPremiumRate = 50;   // 0.5%
    uint256 public maxPremiumRate = 1000; // 10%
    uint256 public constant BASIS_POINTS = 10000;
    
    // Pyth parameters
    uint32 public maxPriceAge = 3600; // 1 hour in seconds
    uint32 public minConfidence = 1000; // Minimum confidence level
    
    // Drawdown thresholds
    uint256 public maxDrawdownBps = 2000; // 20% maximum drawdown
    uint256 public alertDrawdownBps = 1000; // 10% alert threshold
    
    // ============ EVENTS ============
    event PolicyCreated(
        bytes32 indexed policyId,
        address indexed policyHolder,
        address indexed tokenAddress,
        uint256 coverageAmount,
        uint256 premium,
        uint256 expiryTime,
        bytes32 priceId
    );
    
    event PolicyCancelled(
        bytes32 indexed policyId,
        address indexed policyHolder,
        uint256 refundAmount
    );
    
    event ClaimFiled(
        bytes32 indexed policyId,
        address indexed claimant,
        string reason,
        uint256 requestedAmount
    );
    
    event ClaimApproved(
        bytes32 indexed policyId,
        address indexed claimant,
        uint256 payoutAmount,
        string reason
    );
    
    event ClaimDenied(
        bytes32 indexed policyId,
        address indexed claimant,
        string reason
    );
    
    event PriceFeedUpdated(
        bytes32 indexed priceId,
        int64 price,
        uint64 updateTime,
        uint32 confidence
    );
    
    event PremiumRateUpdated(
        uint256 oldRate,
        uint256 newRate
    );
    
    event TokenSupportUpdated(
        address indexed token,
        bool supported
    );
    
    event PriceIdSupportUpdated(
        bytes32 indexed priceId,
        bool supported
    );

    // ============ ERRORS ============
    error InvalidTokenAddress();
    error UnsupportedToken();
    error InvalidCoverageAmount();
    error InvalidDuration();
    error InvalidPremium();
    error PolicyNotFound();
    error PolicyNotActive();
    error PolicyExpired();
    error ClaimNotFound();
    error ClaimAlreadyProcessed();
    error InsufficientBalance();
    error InvalidPriceId();
    error PriceStale();
    error PriceConfidenceTooLow();
    error UnauthorizedClaimant();
    error InvalidAmount();
    error TransferFailed();
    error PythUpdateFailed();
    error InvalidPriceUpdate();

    // ============ MODIFIERS ============
    modifier onlyValidPolicy(bytes32 policyId) {
        if (policies[policyId].policyHolder == address(0)) {
            revert PolicyNotFound();
        }
        _;
    }

    modifier onlyPolicyHolder(bytes32 policyId) {
        if (policies[policyId].policyHolder != msg.sender) {
            revert UnauthorizedClaimant();
        }
        _;
    }

    modifier onlyActivePolicy(bytes32 policyId) {
        if (policies[policyId].status != PolicyStatus.Active) {
            revert PolicyNotActive();
        }
        _;
    }

    modifier onlyValidClaim(bytes32 claimId) {
        if (claims[claimId].claimant == address(0)) {
            revert ClaimNotFound();
        }
        _;
    }

    // ============ CONSTRUCTOR ============
    constructor(
        address _pyth,
        address _paymentToken
    ) Ownable(msg.sender) {
        if (_pyth == address(0) || _paymentToken == address(0)) {
            revert InvalidTokenAddress();
        }
        
        pyth = IPyth(_pyth);
        paymentToken = IERC20(_paymentToken);
    }

    // ============ POLICY MANAGEMENT ============
    
    /**
     * @dev Buy a new insurance policy
     * @param tokenAddress The address of the token to insure
     * @param coverageAmount The amount of coverage requested
     * @param duration The duration of the policy in seconds
     * @param priceId The Pyth price feed ID for the token
     */
    function buyPolicy(
        address tokenAddress,
        uint256 coverageAmount,
        uint256 duration,
        bytes32 priceId
    ) external payable nonReentrant whenNotPaused returns (bytes32) {
        if (tokenAddress == address(0)) revert InvalidTokenAddress();
        if (!supportedTokens[tokenAddress]) revert UnsupportedToken();
        if (coverageAmount == 0) revert InvalidCoverageAmount();
        if (duration == 0 || duration > 365 days) revert InvalidDuration();
        if (!supportedPriceIds[priceId]) revert InvalidPriceId();

        // Get current price from Pyth
        PriceInfo memory priceInfo = _getLatestPrice(priceId);
        
        // Calculate premium based on current price and risk factors
        uint256 premium = _calculatePremium(coverageAmount, duration, priceInfo);
        if (premium < (coverageAmount * minPremiumRate) / BASIS_POINTS) {
            revert InvalidPremium();
        }

        // Transfer premium from user
        paymentToken.safeTransferFrom(msg.sender, address(this), premium);

        // Create policy
        bytes32 policyId = keccak256(
            abi.encodePacked(
                msg.sender,
                tokenAddress,
                coverageAmount,
                block.timestamp,
                block.number,
                priceId
            )
        );

        policies[policyId] = Policy({
            id: policyId,
            policyHolder: msg.sender,
            tokenAddress: tokenAddress,
            coverageAmount: coverageAmount,
            premium: premium,
            expiryTime: block.timestamp + duration,
            createdAt: block.timestamp,
            isActive: true,
            hasClaimed: false,
            status: PolicyStatus.Active,
            priceInfo: priceInfo
        });

        userPolicies[msg.sender].push(policyId);
        allPolicies.push(policyId);
        
        totalPolicies++;
        totalCoverage += coverageAmount;
        totalPremiums += premium;

        emit PolicyCreated(
            policyId,
            msg.sender,
            tokenAddress,
            coverageAmount,
            premium,
            block.timestamp + duration,
            priceId
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
        nonReentrant
    {
        Policy storage policy = policies[policyId];
        
        // Calculate refund (proportional to remaining time)
        uint256 timeRemaining = policy.expiryTime - block.timestamp;
        uint256 totalDuration = policy.expiryTime - policy.createdAt;
        uint256 refundAmount = (policy.premium * timeRemaining) / totalDuration;
        
        policy.isActive = false;
        policy.status = PolicyStatus.Cancelled;
        totalCoverage -= policy.coverageAmount;
        totalPremiums -= (policy.premium - refundAmount);
        
        // Refund proportional premium
        if (refundAmount > 0) {
            paymentToken.safeTransfer(policy.policyHolder, refundAmount);
        }
        
        emit PolicyCancelled(policyId, msg.sender, refundAmount);
    }

    // ============ PRICE FEED MANAGEMENT ============
    
    /**
     * @dev Update price feeds from Pyth
     * @param priceUpdateData Array of price update data from Pyth
     */
    function updatePriceFeeds(bytes[] calldata priceUpdateData) 
        external 
        payable 
        nonReentrant 
    {
        if (priceUpdateData.length == 0) revert InvalidPriceUpdate();
        
        try pyth.updatePriceFeeds{value: msg.value}(priceUpdateData) {
            // Emit events for updated prices
            for (uint256 i = 0; i < priceUpdateData.length; i++) {
                // This is a simplified version - in practice you'd parse the update data
                // to get specific price IDs and values
                emit PriceFeedUpdated(
                    bytes32(0), // Would be actual price ID
                    0, // Would be actual price
                    uint64(block.timestamp), // Would be actual update time
                    0 // Would be actual confidence
                );
            }
        } catch {
            revert PythUpdateFailed();
        }
    }

    /**
     * @dev Get latest price for a specific price ID
     * @param priceId The Pyth price feed ID
     * @return priceInfo The current price information
     */
    function getLatestPrice(bytes32 priceId) 
        external 
        view 
        returns (PriceInfo memory priceInfo) 
    {
        return _getLatestPrice(priceId);
    }

    // ============ CLAIM MANAGEMENT ============
    
    /**
     * @dev File a claim for a policy
     * @param policyId The ID of the policy
     * @param reason The reason for the claim
     * @param requestedAmount The amount being claimed
     */
    function checkClaim(
        bytes32 policyId,
        string calldata reason,
        uint256 requestedAmount
    ) external onlyValidPolicy(policyId) onlyPolicyHolder(policyId) {
        Policy storage policy = policies[policyId];
        
        if (policy.status != PolicyStatus.Active) revert PolicyNotActive();
        if (block.timestamp > policy.expiryTime) revert PolicyExpired();
        if (requestedAmount > policy.coverageAmount) revert InvalidAmount();
        
        bytes32 claimId = keccak256(
            abi.encodePacked(policyId, msg.sender, block.timestamp)
        );
        
        claims[claimId] = ClaimRequest({
            policyId: policyId,
            claimant: msg.sender,
            reason: reason,
            requestedAmount: requestedAmount,
            submittedAt: block.timestamp,
            isProcessed: false,
            status: ClaimStatus.Pending
        });
        
        pendingClaims.push(claimId);
        totalClaims++;
        
        emit ClaimFiled(policyId, msg.sender, reason, requestedAmount);
    }

    /**
     * @dev Settle a claim (only owner)
     * @param claimId The ID of the claim
     * @param approved Whether the claim is approved
     * @param payoutAmount The amount to payout (if approved)
     * @param reason The reason for the decision
     */
    function settleClaim(
        bytes32 claimId,
        bool approved,
        uint256 payoutAmount,
        string calldata reason
    ) external onlyOwner onlyValidClaim(claimId) {
        ClaimRequest storage claim = claims[claimId];
        Policy storage policy = policies[claim.policyId];
        
        if (claim.isProcessed) revert ClaimAlreadyProcessed();
        
        claim.isProcessed = true;
        claim.status = approved ? ClaimStatus.Approved : ClaimStatus.Denied;
        
        if (approved) {
            if (payoutAmount > policy.coverageAmount) revert InvalidAmount();
            if (payoutAmount > paymentToken.balanceOf(address(this))) {
                revert InsufficientBalance();
            }
            
            policy.hasClaimed = true;
            policy.status = PolicyStatus.Claimed;
            totalCoverage -= policy.coverageAmount;
            
            paymentToken.safeTransfer(claim.claimant, payoutAmount);
            
            emit ClaimApproved(claim.policyId, claim.claimant, payoutAmount, reason);
        } else {
            emit ClaimDenied(claim.policyId, claim.claimant, reason);
        }
    }

    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @dev Get latest price from Pyth
     * @param priceId The Pyth price feed ID
     * @return priceInfo The current price information
     */
    function _getLatestPrice(bytes32 priceId) internal view returns (PriceInfo memory priceInfo) {
        if (!supportedPriceIds[priceId]) revert InvalidPriceId();
        
        try pyth.getPrice(priceId) returns (PythStructs.Price memory pythPrice) {
            if (block.timestamp - pythPrice.publishTime > maxPriceAge) {
                revert PriceStale();
            }
            
            if (pythPrice.conf < minConfidence) {
                revert PriceConfidenceTooLow();
            }
            
            priceInfo = PriceInfo({
                priceId: priceId,
                priceUpdateTime: uint64(pythPrice.publishTime),
                price: pythPrice.price,
                confidence: uint32(pythPrice.conf),
                expo: pythPrice.expo,
                twap: 0, // Would calculate TWAP if needed
                normalizedPrice: PriceMath.normalizePythPrice(pythPrice)
            });
        } catch {
            revert PriceStale();
        }
    }

    /**
     * @dev Calculate premium for a policy
     * @param coverageAmount The coverage amount
     * @param duration The policy duration
     * @param priceInfo The current price information
     * @return premium The calculated premium
     */
    function _calculatePremium(
        uint256 coverageAmount,
        uint256 duration,
        PriceInfo memory priceInfo
    ) internal view returns (uint256 premium) {
        // Base premium calculation
        uint256 basePremium = (coverageAmount * basePremiumRate) / BASIS_POINTS;
        
        // Duration factor (longer policies cost more)
        uint256 durationFactor = (duration * 100) / (365 days);
        uint256 durationMultiplier = 100 + durationFactor; // 100% + duration factor
        
        // Price volatility factor based on confidence
        uint256 confidenceFactor = 100 + (uint256(priceInfo.confidence) / 1000);
        
        // Price stability factor (higher price = more stable)
        uint256 priceStabilityFactor = 100;
        if (priceInfo.normalizedPrice > 0) {
            // More expensive tokens are considered more stable
            uint256 priceTier = priceInfo.normalizedPrice / (100 * 10**18); // $100 tiers
            priceStabilityFactor = 100 + (priceTier / 10); // Up to 10% bonus for high-value tokens
        }
        
        // Calculate final premium
        premium = (basePremium * durationMultiplier * confidenceFactor * priceStabilityFactor) / (100 * 100 * 100);
        
        // Ensure premium is within bounds
        uint256 minPremium = (coverageAmount * minPremiumRate) / BASIS_POINTS;
        uint256 maxPremium = (coverageAmount * maxPremiumRate) / BASIS_POINTS;
        
        if (premium < minPremium) premium = minPremium;
        if (premium > maxPremium) premium = maxPremium;
    }

    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Set premium rate (only owner)
     * @param newRate The new premium rate in basis points
     */
    function setPremiumRate(uint256 newRate) external onlyOwner {
        if (newRate < minPremiumRate || newRate > maxPremiumRate) {
            revert InvalidPremium();
        }
        
        uint256 oldRate = basePremiumRate;
        basePremiumRate = newRate;
        
        emit PremiumRateUpdated(oldRate, newRate);
    }

    /**
     * @dev Add or remove token support
     * @param token The token address
     * @param supported Whether the token is supported
     */
    function setTokenSupport(address token, bool supported) external onlyOwner {
        if (token == address(0)) revert InvalidTokenAddress();
        
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    /**
     * @dev Add or remove price ID support
     * @param priceId The Pyth price ID
     * @param supported Whether the price ID is supported
     */
    function setPriceIdSupport(bytes32 priceId, bool supported) external onlyOwner {
        supportedPriceIds[priceId] = supported;
        emit PriceIdSupportUpdated(priceId, supported);
    }

    /**
     * @dev Set price feed parameters
     * @param _maxPriceAge Maximum age of price in seconds
     * @param _minConfidence Minimum confidence level
     */
    function setPriceFeedParams(uint32 _maxPriceAge, uint32 _minConfidence) external onlyOwner {
        maxPriceAge = _maxPriceAge;
        minConfidence = _minConfidence;
    }

    /**
     * @dev Set drawdown thresholds
     * @param _maxDrawdownBps Maximum drawdown in basis points
     * @param _alertDrawdownBps Alert threshold in basis points
     */
    function setDrawdownThresholds(uint256 _maxDrawdownBps, uint256 _alertDrawdownBps) external onlyOwner {
        if (_maxDrawdownBps > BASIS_POINTS || _alertDrawdownBps > BASIS_POINTS) {
            revert InvalidAmount();
        }
        if (_alertDrawdownBps > _maxDrawdownBps) {
            revert InvalidAmount();
        }
        
        maxDrawdownBps = _maxDrawdownBps;
        alertDrawdownBps = _alertDrawdownBps;
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Withdraw funds (only owner)
     * @param amount The amount to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner {
        if (amount > paymentToken.balanceOf(address(this))) {
            revert InsufficientBalance();
        }
        
        paymentToken.safeTransfer(owner(), amount);
    }

    // ============ PRICE ANALYSIS FUNCTIONS ============
    
    /**
     * @dev Check if a token price has experienced significant drawdown
     * @param tokenAddress The token address
     * @param currentPriceId The current price ID
     * @param referencePriceId The reference price ID for comparison
     * @return hasSignificantDrawdown True if drawdown exceeds alert threshold
     * @return drawdownBps The drawdown in basis points
     */
    function checkTokenDrawdown(
        address tokenAddress,
        bytes32 currentPriceId,
        bytes32 referencePriceId
    ) external view returns (bool hasSignificantDrawdown, uint256 drawdownBps) {
        if (!supportedTokens[tokenAddress]) revert UnsupportedToken();
        if (!supportedPriceIds[currentPriceId] || !supportedPriceIds[referencePriceId]) {
            revert InvalidPriceId();
        }
        
        try pyth.getPrice(currentPriceId) returns (PythStructs.Price memory currentPrice) {
            try pyth.getPrice(referencePriceId) returns (PythStructs.Price memory referencePrice) {
                // Validate prices
                if (!PriceMath.validatePythPrice(currentPrice, maxPriceAge)) {
                    revert PriceStale();
                }
                if (!PriceMath.validatePythPrice(referencePrice, maxPriceAge)) {
                    revert PriceStale();
                }
                
                // Calculate drawdown
                drawdownBps = PriceMath.calculateDrawdownFromPyth(currentPrice, referencePrice);
                hasSignificantDrawdown = drawdownBps >= alertDrawdownBps;
            } catch {
                revert PriceStale();
            }
        } catch {
            revert PriceStale();
        }
    }

    /**
     * @dev Get normalized price for a token
     * @param priceId The Pyth price ID
     * @return normalizedPrice The normalized price (1e18 precision)
     */
    function getNormalizedPrice(bytes32 priceId) external view returns (uint256 normalizedPrice) {
        if (!supportedPriceIds[priceId]) revert InvalidPriceId();
        
        try pyth.getPrice(priceId) returns (PythStructs.Price memory pythPrice) {
            if (!PriceMath.validatePythPrice(pythPrice, maxPriceAge)) {
                revert PriceStale();
            }
            
            normalizedPrice = PriceMath.normalizePythPrice(pythPrice);
        } catch {
            revert PriceStale();
        }
    }

    /**
     * @dev Check if a price is below a specific threshold
     * @param currentPriceId The current price ID
     * @param referencePriceId The reference price ID
     * @param thresholdBps The threshold in basis points
     * @return isBelowThreshold True if price is below threshold
     */
    function isPriceBelowThreshold(
        bytes32 currentPriceId,
        bytes32 referencePriceId,
        uint256 thresholdBps
    ) external view returns (bool isBelowThreshold) {
        if (!supportedPriceIds[currentPriceId] || !supportedPriceIds[referencePriceId]) {
            revert InvalidPriceId();
        }
        if (thresholdBps > BASIS_POINTS) revert InvalidAmount();
        
        try pyth.getPrice(currentPriceId) returns (PythStructs.Price memory currentPrice) {
            try pyth.getPrice(referencePriceId) returns (PythStructs.Price memory referencePrice) {
                if (!PriceMath.validatePythPrice(currentPrice, maxPriceAge)) {
                    revert PriceStale();
                }
                if (!PriceMath.validatePythPrice(referencePrice, maxPriceAge)) {
                    revert PriceStale();
                }
                
                uint256 currentNormalized = PriceMath.normalizePythPrice(currentPrice);
                uint256 referenceNormalized = PriceMath.normalizePythPrice(referencePrice);
                
                isBelowThreshold = PriceMath.isPriceBelowThreshold(
                    currentNormalized,
                    referenceNormalized,
                    thresholdBps
                );
            } catch {
                revert PriceStale();
            }
        } catch {
            revert PriceStale();
        }
    }

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get user's policies
     * @param user The user's address
     * @return Array of policy IDs
     */
    function getUserPolicies(address user) external view returns (bytes32[] memory) {
        return userPolicies[user];
    }

    /**
     * @dev Get policy details
     * @param policyId The policy ID
     * @return policy The policy details
     */
    function getPolicy(bytes32 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    /**
     * @dev Get claim details
     * @param claimId The claim ID
     * @return claim The claim details
     */
    function getClaim(bytes32 claimId) external view returns (ClaimRequest memory) {
        return claims[claimId];
    }

    /**
     * @dev Get all pending claims
     * @return Array of claim IDs
     */
    function getPendingClaims() external view returns (bytes32[] memory) {
        return pendingClaims;
    }

    /**
     * @dev Get contract statistics
     * @return _totalPolicies The total number of policies
     * @return _totalCoverage The total coverage amount
     * @return _totalPremiums The total premiums collected
     * @return _totalClaims The total number of claims
     * @return _contractBalance The contract's token balance
     */
    function getStats() external view returns (
        uint256 _totalPolicies,
        uint256 _totalCoverage,
        uint256 _totalPremiums,
        uint256 _totalClaims,
        uint256 _contractBalance
    ) {
        return (
            totalPolicies,
            totalCoverage,
            totalPremiums,
            totalClaims,
            paymentToken.balanceOf(address(this))
        );
    }

    // ============ RECEIVE FUNCTION ============
    receive() external payable {
        // Allow contract to receive ETH for Pyth updates
    }
}

