// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "../interfaces/IFractionalCredit.sol";
import "../access/TerraQuraAccessControl.sol";

/**
 * @title FractionalCredit
 * @author TerraQura
 * @notice ERC-20 wrapper for ERC-1155 carbon credits enabling fractional ownership
 * @dev Each deployment wraps a single creditId. 1 ERC-1155 credit = 1e18 ERC-20 tokens,
 *      enabling fractional precision for DeFi composability (Uniswap, Aave, etc.).
 *
 *      Factory pattern: deploy one FractionalCredit proxy per creditId.
 *      UUPS upgradeable with TerraQuraAccessControl RBAC.
 */
contract FractionalCredit is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ERC1155HolderUpgradeable,
    IFractionalCredit
{
    // ============================================
    // STATE
    // ============================================

    TerraQuraAccessControl public accessControl;
    IERC1155Upgradeable public carbonCredit;

    /// @notice The ERC-1155 credit ID this contract wraps
    uint256 public wrappedCreditId;

    /// @notice Total number of whole ERC-1155 credits locked in this contract
    uint256 public totalWrappedCredits;

    /// @notice Conversion factor: 1 ERC-1155 credit = 1e18 ERC-20 tokens
    uint256 public constant WRAP_RATIO = 1e18;

    // ============================================
    // ERRORS
    // ============================================

    error ZeroAmount();
    error InsufficientWrappedBalance();
    error MustUnwrapWholeCredits();
    error Unauthorized();

    // ============================================
    // INITIALIZER
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the fractional credit wrapper
     * @param _accessControl TerraQuraAccessControl address
     * @param _carbonCredit CarbonCredit ERC-1155 address
     * @param _creditId The specific credit ID to wrap
     */
    function initialize(
        address _accessControl,
        address _carbonCredit,
        uint256 _creditId
    ) public initializer {
        string memory idStr = _uint256ToString(_creditId);
        string memory tokenName = string(abi.encodePacked("Wrapped TerraQura Credit #", idStr));
        string memory tokenSymbol = string(abi.encodePacked("wTQC-", idStr));

        __ERC20_init(tokenName, tokenSymbol);
        __ERC20Burnable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        __ERC1155Holder_init();

        accessControl = TerraQuraAccessControl(_accessControl);
        carbonCredit = IERC1155Upgradeable(_carbonCredit);
        wrappedCreditId = _creditId;
    }

    // ============================================
    // WRAP / UNWRAP
    // ============================================

    /**
     * @inheritdoc IFractionalCredit
     * @dev Deposits `amount` ERC-1155 credits and mints `amount * 1e18` ERC-20 tokens.
     */
    function wrap(uint256 creditId, uint256 amount) external nonReentrant returns (uint256 erc20Amount) {
        if (creditId != wrappedCreditId) revert ZeroAmount(); // wrong credit
        if (amount == 0) revert ZeroAmount();

        erc20Amount = amount * WRAP_RATIO;

        // Transfer ERC-1155 from user to this contract
        carbonCredit.safeTransferFrom(msg.sender, address(this), wrappedCreditId, amount, "");

        // Mint ERC-20 tokens
        _mint(msg.sender, erc20Amount);
        totalWrappedCredits += amount;

        emit Wrapped(msg.sender, wrappedCreditId, amount, erc20Amount);
    }

    /**
     * @inheritdoc IFractionalCredit
     * @dev Burns `amount` ERC-20 tokens (must be multiple of 1e18) and returns whole ERC-1155 credits.
     */
    function unwrap(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount % WRAP_RATIO != 0) revert MustUnwrapWholeCredits();

        uint256 creditAmount = amount / WRAP_RATIO;
        if (creditAmount > totalWrappedCredits) revert InsufficientWrappedBalance();

        // Burn ERC-20 tokens
        _burn(msg.sender, amount);
        totalWrappedCredits -= creditAmount;

        // Return ERC-1155 credits
        carbonCredit.safeTransferFrom(address(this), msg.sender, wrappedCreditId, creditAmount, "");

        emit Unwrapped(msg.sender, wrappedCreditId, creditAmount, amount);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @inheritdoc IFractionalCredit
     */
    function getWrappedCreditId() external view returns (uint256) {
        return wrappedCreditId;
    }

    /**
     * @inheritdoc IFractionalCredit
     */
    function totalWrapped() external view returns (uint256) {
        return totalWrappedCredits;
    }

    // ============================================
    // INTERNAL
    // ============================================

    function _authorizeUpgrade(address) internal view override {
        if (!accessControl.hasRole(accessControl.UPGRADER_ROLE(), msg.sender)) revert Unauthorized();
    }

    /**
     * @dev Convert uint256 to string for token naming
     */
    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
