// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

/// @title OracleAdapter — Chainlink ETH/USD wrapper with circuit breaker
contract OracleAdapter {
    AggregatorV3Interface public immutable feed;

    // --- Circuit breaker config ---
    uint256 public constant MAX_PRICE_MOVE_BPS = 500;     // 5% in basis points
    uint256 public constant STALENESS_THRESHOLD = 3600;   // 1 hour

    uint256 public lastPrice;        // last observed price (18-dec scaled)
    uint256 public lastBlockSeen;
    bool public tripped;

    error StalePrice(uint256 updatedAt);
    error InvalidPrice(int256 raw);
    error CircuitBreakerTripped();

    constructor(address _feed) {
        feed = AggregatorV3Interface(_feed);
    }

    /// @notice Returns latest ETH price in USD, scaled to 18 decimals.
    /// @dev Reverts if price stale, invalid, or circuit breaker tripped.
    function getPriceUSD() external returns (uint256) {
        if (tripped) revert CircuitBreakerTripped();

        (, int256 raw, , uint256 updatedAt, ) = feed.latestRoundData();
        if (raw <= 0) revert InvalidPrice(raw);
        if (block.timestamp - updatedAt > STALENESS_THRESHOLD)
            revert StalePrice(updatedAt);

        uint8 dec = feed.decimals();
        uint256 price = uint256(raw) * (10 ** (18 - dec));   // scale to 1e18

        // Circuit breaker check: same-block movement > threshold = trip
        if (lastPrice != 0 && block.number == lastBlockSeen) {
            uint256 diff = price > lastPrice
                ? price - lastPrice
                : lastPrice - price;
            uint256 bps = (diff * 10_000) / lastPrice;
            if (bps > MAX_PRICE_MOVE_BPS) {
                tripped = true;
                revert CircuitBreakerTripped();
            }
        }

        lastPrice = price;
        lastBlockSeen = block.number;
        return price;
    }

    /// @notice Read-only variant for view-only callers (frontend, health checks)
    function peekPriceUSD() external view returns (uint256) {
        (, int256 raw, , , ) = feed.latestRoundData();
        if (raw <= 0) return 0;
        uint8 dec = feed.decimals();
        return uint256(raw) * (10 ** (18 - dec));
    }
}