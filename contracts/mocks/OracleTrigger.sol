// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IOracle {
    function getPriceUSD() external returns (uint256);
}

interface IMock {
    function setPrice(int256 _price) external;
}

/// @notice Test helper that brackets a price change between two
///         OracleAdapter.getPriceUSD() calls in a single transaction.
///         Used to deterministically exercise the same-block circuit
///         breaker — a single tx is, by definition, a single block.
contract OracleTrigger {
    function pumpAndCheck(address oracle, address mock, int256 newPrice) external {
        IOracle(oracle).getPriceUSD();
        IMock(mock).setPrice(newPrice);
        IOracle(oracle).getPriceUSD();
    }
}
