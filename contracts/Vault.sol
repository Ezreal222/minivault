// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MiniUSD.sol";
import "./OracleAdapter.sol";

contract Vault {
    MiniUSD public immutable stablecoin;
    OracleAdapter public immutable oracle;

    // --- CDP parameters ---
    uint256 public constant MIN_COLLATERAL_RATIO = 150;   // 150% (overcollateralized)
    uint256 public constant LIQUIDATION_BONUS = 10;       // 10% bonus to liquidator

    struct Position {
        uint256 collateralETH;   // wei
        uint256 debtUSD;         // mUSD (18 dec)
    }
    mapping(address => Position) public positions;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Minted(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator,
                     uint256 collateralSeized, uint256 debtRepaid);

    error Undercollateralized();
    error NoPosition();
    error InsufficientCollateral();
    error PositionHealthy();

    constructor(address _stablecoin, address _oracle) {
        stablecoin = MiniUSD(_stablecoin);
        oracle = OracleAdapter(_oracle);
    }

    // --- Core actions ---

    function depositCollateral() external payable {
        require(msg.value > 0, "Zero deposit");
        positions[msg.sender].collateralETH += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function mintStablecoin(uint256 amount) external {
        positions[msg.sender].debtUSD += amount;
        if (!_isHealthy(msg.sender)) revert Undercollateralized();
        stablecoin.mint(msg.sender, amount);
        emit Minted(msg.sender, amount);
    }

    function repay(uint256 amount) external {
        Position storage p = positions[msg.sender];
        require(p.debtUSD >= amount, "Repay exceeds debt");
        stablecoin.burn(msg.sender, amount);   // user must approve? No — burn pulls from user
        p.debtUSD -= amount;
        emit Repaid(msg.sender, amount);
    }

    function withdrawCollateral(uint256 amount) external {
        Position storage p = positions[msg.sender];
        if (p.collateralETH < amount) revert InsufficientCollateral();
        p.collateralETH -= amount;
        if (!_isHealthy(msg.sender)) revert Undercollateralized();
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Liquidate an undercollateralized position
    /// @dev Liquidator burns the user's debt and receives collateral + bonus
    function liquidate(address user) external {
        if (_isHealthy(user)) revert PositionHealthy();
        Position storage p = positions[user];
        uint256 debt = p.debtUSD;
        uint256 collateral = p.collateralETH;

        // Liquidator burns mUSD equal to user's debt
        stablecoin.burn(msg.sender, debt);

        // Send all collateral to liquidator (simple model — refine for paper)
        p.debtUSD = 0;
        p.collateralETH = 0;
        (bool ok, ) = msg.sender.call{value: collateral}("");
        require(ok, "Transfer failed");

        emit Liquidated(user, msg.sender, collateral, debt);
    }

    // --- Views ---

    function healthFactor(address user) public view returns (uint256) {
        Position memory p = positions[user];
        if (p.debtUSD == 0) return type(uint256).max;
        uint256 priceUSD = oracle.peekPriceUSD();
        uint256 collateralValueUSD = (p.collateralETH * priceUSD) / 1e18;
        return (collateralValueUSD * 100) / p.debtUSD;   // returns percentage
    }

    function _isHealthy(address user) internal returns (bool) {
        Position memory p = positions[user];
        if (p.debtUSD == 0) return true;
        uint256 priceUSD = oracle.getPriceUSD();          // uses guarded version
        uint256 collateralValueUSD = (p.collateralETH * priceUSD) / 1e18;
        return collateralValueUSD * 100 >= p.debtUSD * MIN_COLLATERAL_RATIO;
    }

    receive() external payable {
        positions[msg.sender].collateralETH += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
}