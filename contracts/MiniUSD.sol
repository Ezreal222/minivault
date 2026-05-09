// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MiniUSD — USD-pegged stablecoin minted by the Vault
/// @notice Only the Vault contract can mint or burn
contract MiniUSD is ERC20 {
    address public vault;

    error OnlyVault();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor() ERC20("MiniUSD", "mUSD") {}

    /// @dev Vault address is set once after deployment to break circular
    ///      dependency between Vault and MiniUSD constructors
    function setVault(address _vault) external {
        require(vault == address(0), "Vault already set");
        vault = _vault;
    }

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }
}