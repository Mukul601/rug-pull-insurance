// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/libraries/PriceMath.sol";
import "../contracts/interfaces/PythStructs.sol";

contract PriceMathTest is Test {
    using PriceMath for PythStructs.Price;

    function testNormalizePrice() public {
        // Test case 1: Price with positive exponent
        int64 price = 2000 * 10**8; // $2000 with 8 decimals
        int32 expo = -8; // Pyth uses negative exponent
        uint256 expected = 2000 * 10**18; // Should normalize to 1e18 precision
        
        uint256 result = PriceMath.normalizePrice(price, expo);
        assertEq(result, expected);
    }

    function testNormalizePriceNegativeExponent() public {
        // Test case 2: Price with negative exponent
        int64 price = 5000; // $5000 with 0 decimals
        int32 expo = 0; // No exponent adjustment needed
        uint256 expected = 5000 * 10**18; // Should normalize to 1e18 precision
        
        uint256 result = PriceMath.normalizePrice(price, expo);
        assertEq(result, expected);
    }

    function testNormalizePriceLargeExponent() public {
        // Test case 3: Price with large positive exponent
        int64 price = 1; // $1
        int32 expo = 6; // 6 decimals
        uint256 expected = 1 * 10**24; // 1e24 (1e18 + 6)
        
        uint256 result = PriceMath.normalizePrice(price, expo);
        assertEq(result, expected);
    }

    function testNormalizePriceSmallExponent() public {
        // Test case 4: Price with small negative exponent
        int64 price = 1000000; // $1,000,000
        int32 expo = -6; // -6 decimals
        uint256 expected = 1000000 * 10**12; // 1e18 (1e18 - 6)
        
        uint256 result = PriceMath.normalizePrice(price, expo);
        assertEq(result, expected);
    }

    function testNormalizePriceInvalidInputs() public {
        // Test invalid price (zero)
        vm.expectRevert(PriceMath.InvalidPrice.selector);
        PriceMath.normalizePrice(0, 0);
        
        // Test invalid price (negative)
        vm.expectRevert(PriceMath.InvalidPrice.selector);
        PriceMath.normalizePrice(-100, 0);
        
        // Test invalid exponent (too large)
        vm.expectRevert(PriceMath.InvalidExponent.selector);
        PriceMath.normalizePrice(1000, 19);
        
        // Test invalid exponent (too small)
        vm.expectRevert(PriceMath.InvalidExponent.selector);
        PriceMath.normalizePrice(1000, -19);
    }

    function testNormalizePythPrice() public {
        PythStructs.Price memory pythPrice = PythStructs.Price({
            price: 1500 * 10**8, // $1500
            conf: 1000,
            expo: -8,
            publishTime: block.timestamp
        });
        
        uint256 expected = 1500 * 10**18;
        uint256 result = PriceMath.normalizePythPrice(pythPrice);
        assertEq(result, expected);
    }

    function testCalculateDrawdownBps() public {
        // Test case 1: 10% drawdown
        uint256 currentPrice = 900 * 10**18; // $900
        uint256 previousPrice = 1000 * 10**18; // $1000
        uint256 expected = 1000; // 10% = 1000 basis points
        
        uint256 result = PriceMath.calculateDrawdownBps(currentPrice, previousPrice);
        assertEq(result, expected);
    }

    function testCalculateDrawdownBpsNoDrawdown() public {
        // Test case 2: No drawdown (price increased)
        uint256 currentPrice = 1100 * 10**18; // $1100
        uint256 previousPrice = 1000 * 10**18; // $1000
        uint256 expected = 0; // No drawdown
        
        uint256 result = PriceMath.calculateDrawdownBps(currentPrice, previousPrice);
        assertEq(result, expected);
    }

    function testCalculateDrawdownBpsMaxDrawdown() public {
        // Test case 3: 100% drawdown
        uint256 currentPrice = 0; // $0
        uint256 previousPrice = 1000 * 10**18; // $1000
        uint256 expected = 10000; // 100% = 10000 basis points
        
        uint256 result = PriceMath.calculateDrawdownBps(currentPrice, previousPrice);
        assertEq(result, expected);
    }

    function testCalculateDrawdownBpsDivisionByZero() public {
        // Test case 4: Division by zero
        uint256 currentPrice = 1000 * 10**18;
        uint256 previousPrice = 0;
        
        vm.expectRevert(PriceMath.DivisionByZero.selector);
        PriceMath.calculateDrawdownBps(currentPrice, previousPrice);
    }

    function testCalculateDrawdownPercent() public {
        uint256 currentPrice = 750 * 10**18; // $750
        uint256 previousPrice = 1000 * 10**18; // $1000
        uint256 expected = 25; // 25%
        
        uint256 result = PriceMath.calculateDrawdownPercent(currentPrice, previousPrice);
        assertEq(result, expected);
    }

    function testCalculateDrawdownFromPyth() public {
        PythStructs.Price memory currentPrice = PythStructs.Price({
            price: 800 * 10**8, // $800
            conf: 1000,
            expo: -8,
            publishTime: block.timestamp
        });
        
        PythStructs.Price memory previousPrice = PythStructs.Price({
            price: 1000 * 10**8, // $1000
            conf: 1000,
            expo: -8,
            publishTime: block.timestamp - 3600
        });
        
        uint256 expected = 2000; // 20% = 2000 basis points
        uint256 result = PriceMath.calculateDrawdownFromPyth(currentPrice, previousPrice);
        assertEq(result, expected);
    }

    function testIsPriceBelowThreshold() public {
        uint256 currentPrice = 850 * 10**18; // $850
        uint256 previousPrice = 1000 * 10**18; // $1000
        uint256 thresholdBps = 1000; // 10% threshold
        
        bool result = PriceMath.isPriceBelowThreshold(currentPrice, previousPrice, thresholdBps);
        assertTrue(result); // 15% drawdown > 10% threshold
        
        // Test below threshold
        uint256 thresholdBps2 = 2000; // 20% threshold
        bool result2 = PriceMath.isPriceBelowThreshold(currentPrice, previousPrice, thresholdBps2);
        assertFalse(result2); // 15% drawdown < 20% threshold
    }

    function testIsPriceBelowThresholdInvalid() public {
        uint256 currentPrice = 1000 * 10**18;
        uint256 previousPrice = 1000 * 10**18;
        uint256 thresholdBps = 10001; // Invalid threshold > 100%
        
        vm.expectRevert(PriceMath.InvalidPrice.selector);
        PriceMath.isPriceBelowThreshold(currentPrice, previousPrice, thresholdBps);
    }

    function testCalculatePriceChangeBps() public {
        // Test price increase
        uint256 currentPrice = 1100 * 10**18; // $1100
        uint256 previousPrice = 1000 * 10**18; // $1000
        int256 expected = 1000; // 10% increase = 1000 basis points
        
        int256 result = PriceMath.calculatePriceChangeBps(currentPrice, previousPrice);
        assertEq(result, expected);
        
        // Test price decrease
        uint256 currentPrice2 = 900 * 10**18; // $900
        int256 expected2 = -1000; // 10% decrease = -1000 basis points
        
        int256 result2 = PriceMath.calculatePriceChangeBps(currentPrice2, previousPrice);
        assertEq(result2, expected2);
    }

    function testCalculatePriceChangeBpsDivisionByZero() public {
        uint256 currentPrice = 1000 * 10**18;
        uint256 previousPrice = 0;
        
        vm.expectRevert(PriceMath.DivisionByZero.selector);
        PriceMath.calculatePriceChangeBps(currentPrice, previousPrice);
    }

    function testValidatePythPrice() public {
        PythStructs.Price memory validPrice = PythStructs.Price({
            price: 1000 * 10**8,
            conf: 1000,
            expo: -8,
            publishTime: block.timestamp
        });
        
        bool result = PriceMath.validatePythPrice(validPrice, 3600); // 1 hour max age
        assertTrue(result);
    }

    function testValidatePythPriceInvalid() public {
        // Test invalid price (zero)
        PythStructs.Price memory invalidPrice1 = PythStructs.Price({
            price: 0,
            conf: 1000,
            expo: -8,
            publishTime: block.timestamp
        });
        
        bool result1 = PriceMath.validatePythPrice(invalidPrice1, 3600);
        assertFalse(result1);
        
        // Test invalid exponent
        PythStructs.Price memory invalidPrice2 = PythStructs.Price({
            price: 1000 * 10**8,
            conf: 1000,
            expo: 19, // Too large
            publishTime: block.timestamp
        });
        
        bool result2 = PriceMath.validatePythPrice(invalidPrice2, 3600);
        assertFalse(result2);
        
        // Test stale price
        PythStructs.Price memory stalePrice = PythStructs.Price({
            price: 1000 * 10**8,
            conf: 1000,
            expo: -8,
            publishTime: block.timestamp - 7200 // 2 hours ago
        });
        
        bool result3 = PriceMath.validatePythPrice(stalePrice, 3600); // 1 hour max age
        assertFalse(result3);
        
        // Test zero confidence
        PythStructs.Price memory zeroConfPrice = PythStructs.Price({
            price: 1000 * 10**8,
            conf: 0,
            expo: -8,
            publishTime: block.timestamp
        });
        
        bool result4 = PriceMath.validatePythPrice(zeroConfPrice, 3600);
        assertFalse(result4);
    }

    function testIsPriceStale() public {
        PythStructs.Price memory freshPrice = PythStructs.Price({
            price: 1000 * 10**8,
            conf: 1000,
            expo: -8,
            publishTime: block.timestamp - 1800 // 30 minutes ago
        });
        
        bool result1 = PriceMath.isPriceStale(freshPrice, 3600); // 1 hour max age
        assertFalse(result1);
        
        PythStructs.Price memory stalePrice = PythStructs.Price({
            price: 1000 * 10**8,
            conf: 1000,
            expo: -8,
            publishTime: block.timestamp - 7200 // 2 hours ago
        });
        
        bool result2 = PriceMath.isPriceStale(stalePrice, 3600); // 1 hour max age
        assertTrue(result2);
    }

    function testBpsToPercent() public {
        assertEq(PriceMath.bpsToPercent(1000), 10); // 1000 bps = 10%
        assertEq(PriceMath.bpsToPercent(500), 5);   // 500 bps = 5%
        assertEq(PriceMath.bpsToPercent(10000), 100); // 10000 bps = 100%
        assertEq(PriceMath.bpsToPercent(0), 0);     // 0 bps = 0%
    }

    function testPercentToBps() public {
        assertEq(PriceMath.percentToBps(10), 1000);  // 10% = 1000 bps
        assertEq(PriceMath.percentToBps(5), 500);    // 5% = 500 bps
        assertEq(PriceMath.percentToBps(100), 10000); // 100% = 10000 bps
        assertEq(PriceMath.percentToBps(0), 0);      // 0% = 0 bps
    }

    function testCalculateMinPrice() public {
        uint256 referencePrice = 1000 * 10**18; // $1000
        uint256 maxDrawdownBps = 2000; // 20%
        uint256 expected = 800 * 10**18; // $800
        
        uint256 result = PriceMath.calculateMinPrice(referencePrice, maxDrawdownBps);
        assertEq(result, expected);
    }

    function testCalculateMaxPrice() public {
        uint256 referencePrice = 1000 * 10**18; // $1000
        uint256 maxDrawdownBps = 1000; // 10%
        uint256 expected = 1100 * 10**18; // $1100
        
        uint256 result = PriceMath.calculateMaxPrice(referencePrice, maxDrawdownBps);
        assertEq(result, expected);
    }

    function testCalculateWeightedAverage() public {
        uint256[] memory prices = new uint256[](3);
        prices[0] = 1000 * 10**18; // $1000
        prices[1] = 2000 * 10**18; // $2000
        prices[2] = 3000 * 10**18; // $3000
        
        uint256[] memory weights = new uint256[](3);
        weights[0] = 500 * 10**15; // 50%
        weights[1] = 300 * 10**15; // 30%
        weights[2] = 200 * 10**15; // 20%
        
        uint256 expected = 1700 * 10**18; // (1000*0.5 + 2000*0.3 + 3000*0.2) = 1700
        uint256 result = PriceMath.calculateWeightedAverage(prices, weights);
        assertEq(result, expected);
    }

    function testCalculateWeightedAverageInvalid() public {
        uint256[] memory prices = new uint256[](2);
        prices[0] = 1000 * 10**18;
        prices[1] = 2000 * 10**18;
        
        uint256[] memory weights = new uint256[](3); // Different length
        weights[0] = 500 * 10**15;
        weights[1] = 300 * 10**15;
        weights[2] = 200 * 10**15;
        
        vm.expectRevert(PriceMath.InvalidPrice.selector);
        PriceMath.calculateWeightedAverage(prices, weights);
    }

    function testCalculateAverage() public {
        uint256[] memory prices = new uint256[](3);
        prices[0] = 1000 * 10**18; // $1000
        prices[1] = 2000 * 10**18; // $2000
        prices[2] = 3000 * 10**18; // $3000
        
        uint256 expected = 2000 * 10**18; // (1000 + 2000 + 3000) / 3 = 2000
        uint256 result = PriceMath.calculateAverage(prices);
        assertEq(result, expected);
    }

    function testCalculateAverageEmpty() public {
        uint256[] memory prices = new uint256[](0);
        
        vm.expectRevert(PriceMath.InvalidPrice.selector);
        PriceMath.calculateAverage(prices);
    }

    function testNormalizePriceToPrecision() public {
        int64 price = 1000 * 10**6; // $1000 with 6 decimals
        int32 expo = -6;
        uint256 targetPrecision = 1e18;
        uint256 expected = 1000 * 10**18;
        
        uint256 result = PriceMath.normalizePriceToPrecision(price, expo, targetPrecision);
        assertEq(result, expected);
    }

    function testNormalizePriceToPrecisionUSDC() public {
        int64 price = 1000 * 10**6; // $1000 with 6 decimals (USDC style)
        int32 expo = -6;
        uint256 targetPrecision = 1e6; // USDC precision
        uint256 expected = 1000 * 10**6;
        
        uint256 result = PriceMath.normalizePriceToPrecision(price, expo, targetPrecision);
        assertEq(result, expected);
    }

    function testNormalizePriceToPrecisionInvalid() public {
        int64 price = 1000;
        int32 expo = -6;
        uint256 targetPrecision = 0; // Invalid precision
        
        vm.expectRevert(PriceMath.DivisionByZero.selector);
        PriceMath.normalizePriceToPrecision(price, expo, targetPrecision);
    }
}
