// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol"; // Import standard interface
import "../interfaces/ICircuitBreaker.sol";
// REMOVED: import .../ERC2771ContextUpgradeable.sol (Bypassing version conflict)

interface ICarbonCreditBase {
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
}

interface ITerraQuraAccessControl {
    function ADMIN_ROLE() external view returns (bytes32);
    function UPGRADER_ROLE() external view returns (bytes32);
    function hasRole(bytes32 role, address account) external view returns (bool);
}

/**
 * @title GaslessMarketplace
 * @dev Marketplace with INLINE ERC-2771 support and Fixed v4 Inheritance.
 */
contract GaslessMarketplace is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC1155HolderUpgradeable
{
    bytes32 public constant MARKET_ROLE = keccak256("MARKET_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    address public carbonCredit; // Stored as address to allow casting
    address private _trustedForwarder;

    struct Listing {
        uint256 listingId;
        address seller;
        uint256 tokenId;
        uint256 amount;
        uint256 pricePerUnit;
        bool active;
    }

    uint256 private _listingIds;
    mapping(uint256 => Listing) public listings;
    address public accessControl;
    ICircuitBreaker public circuitBreaker;

    event ListingCreated(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 amount, uint256 pricePerUnit);
    event ListingSold(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPrice);
    event ListingCancelled(uint256 indexed listingId);
    event TrustedForwarderUpdated(address indexed previousForwarder, address indexed newForwarder);
    event CircuitBreakerUpdated(address indexed previousCircuitBreaker, address indexed newCircuitBreaker);

    error InvalidAccessControl();
    error InvalidCarbonCredit();
    error InvalidTrustedForwarder();
    error UnauthorizedAdmin();
    error InvalidCircuitBreaker();
    error CircuitBreakerBlocked();
    error CircuitBreakerRateLimited();
    error CircuitBreakerVolumeExceeded();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _accessControl,
        address _carbonCredit,
        address _forwarderAddress
    ) public initializer {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __ERC1155Holder_init();
        if (_accessControl == address(0)) revert InvalidAccessControl();
        if (_carbonCredit == address(0)) revert InvalidCarbonCredit();
        if (_forwarderAddress.code.length == 0) revert InvalidTrustedForwarder();

        accessControl = _accessControl;
        _trustedForwarder = _forwarderAddress;
        carbonCredit = _carbonCredit;

        _grantRole(DEFAULT_ADMIN_ROLE, _accessControl);
        _grantRole(ADMIN_ROLE, _accessControl);
    }

    function createListing(
        uint256 _tokenId,
        uint256 _amount,
        uint256 _pricePerUnit
    ) external nonReentrant {
        _enforceCircuitBreaker(0);
        require(_amount > 0, "Amount must be > 0");
        
        address seller = _msgSender();

        // FIX: Cast to standard IERC1155 to ensure balanceOf exists
        require(
            IERC1155(carbonCredit).balanceOf(seller, _tokenId) >= _amount,
            "Insufficient balance"
        );
        require(
            IERC1155(carbonCredit).isApprovedForAll(seller, address(this)),
            "Marketplace not approved"
        );

        _listingIds++;
        listings[_listingIds] = Listing({
            listingId: _listingIds,
            seller: seller,
            tokenId: _tokenId,
            amount: _amount,
            pricePerUnit: _pricePerUnit,
            active: true
        });

        emit ListingCreated(_listingIds, seller, _tokenId, _amount, _pricePerUnit);
    }

    function buyListing(uint256 _listingId, uint256 _amountToBuy) external payable nonReentrant {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(listing.amount >= _amountToBuy, "Insufficient listing amount");

        uint256 totalPrice = _amountToBuy * listing.pricePerUnit;
        require(msg.value >= totalPrice, "Insufficient payment");

        _enforceCircuitBreaker(totalPrice);

        address buyer = _msgSender();

        listing.amount -= _amountToBuy;
        if (listing.amount == 0) {
            listing.active = false;
        }

        // FIX: Use interface for transfer
        ICarbonCreditBase(carbonCredit).safeTransferFrom(listing.seller, buyer, listing.tokenId, _amountToBuy, "");
        
        (bool success, ) = payable(listing.seller).call{value: totalPrice}("");
        require(success, "Transfer to seller failed");

        emit ListingSold(_listingId, buyer, _amountToBuy, totalPrice);
    }

    // --- MANUAL ERC-2771 LOGIC ---

    function isTrustedForwarder(address forwarder) public view virtual returns (bool) {
        return forwarder == _trustedForwarder;
    }

    function setTrustedForwarder(address newForwarder) external {
        _requireGovernanceRole(
            ITerraQuraAccessControl(accessControl).ADMIN_ROLE()
        );
        if (newForwarder.code.length == 0) revert InvalidTrustedForwarder();

        address previousForwarder = _trustedForwarder;
        _trustedForwarder = newForwarder;
        emit TrustedForwarderUpdated(previousForwarder, newForwarder);
    }

    function setCircuitBreaker(address newCircuitBreaker) external {
        _requireGovernanceRole(
            ITerraQuraAccessControl(accessControl).ADMIN_ROLE()
        );
        if (newCircuitBreaker == address(0)) revert InvalidCircuitBreaker();

        address previousCircuitBreaker = address(circuitBreaker);
        circuitBreaker = ICircuitBreaker(newCircuitBreaker);

        emit CircuitBreakerUpdated(previousCircuitBreaker, newCircuitBreaker);
    }

    function _msgSender() internal view virtual override returns (address sender) {
        if (isTrustedForwarder(msg.sender)) {
            if (msg.data.length >= 20) {
                return address(bytes20(msg.data[msg.data.length - 20:]));
            }
        }
        return msg.sender;
    }

    /**
     * @notice ERC-2771 compliant _msgData override for meta-transactions
     * @dev This function is part of the standard ERC-2771 implementation from OpenZeppelin.
     *      It strips the appended sender address from calldata when called via trusted forwarder.
     *
     *      AUDIT NOTE: This function is not directly invoked by any function in this contract
     *      (only _msgSender is used for sender extraction), but is required for full ERC-2771
     *      compliance and potential future use by inherited contracts.
     *      The logic mirrors OpenZeppelin's ERC2771Context implementation verbatim.
     *      See .solcover.js for coverage waiver documentation.
     *
     * @return The original calldata (truncated if from forwarder, full if direct call)
     */
    function _msgData() internal view virtual override returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender)) {
            return msg.data[:msg.data.length - 20];
        }
        return msg.data;
    }

    // --- FIX: REQUIRED OVERRIDE FOR SOLC ---
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControlUpgradeable, ERC1155ReceiverUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // --- UUPS UPGRADE AUTHORIZATION ---
    function _authorizeUpgrade(address) internal view override {
        _requireGovernanceRole(
            ITerraQuraAccessControl(accessControl).UPGRADER_ROLE()
        );
    }

    function _requireGovernanceRole(bytes32 role) internal view {
        ITerraQuraAccessControl ac = ITerraQuraAccessControl(accessControl);
        if (!ac.hasRole(role, msg.sender) && !ac.hasRole(ac.ADMIN_ROLE(), msg.sender)) {
            revert UnauthorizedAdmin();
        }
    }

    function _enforceCircuitBreaker(uint256 volume) internal {
        address breaker = address(circuitBreaker);
        if (breaker == address(0)) {
            return;
        }

        if (!circuitBreaker.isOperationAllowed(address(this))) {
            revert CircuitBreakerBlocked();
        }
        if (!circuitBreaker.checkRateLimit(address(this))) {
            revert CircuitBreakerRateLimited();
        }
        if (volume > 0 && !circuitBreaker.checkVolumeLimit(address(this), volume)) {
            revert CircuitBreakerVolumeExceeded();
        }
    }
}
