// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../interfaces/IRetirementCertificate.sol";

/**
 * @title RetirementCertificate
 * @author TerraQura
 * @notice ERC-721 NFT representing permanent carbon credit retirement certificates
 * @dev Uses UUPS proxy pattern for upgradeability. Certificates contain fully on-chain
 *      metadata (no IPFS dependency). Supports soulbound mode to prevent transfers.
 *      Only the CarbonRetirement contract can mint certificates.
 */
contract RetirementCertificate is
    Initializable,
    ERC721EnumerableUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    IRetirementCertificate
{
    using Strings for uint256;

    // ============ State Variables ============

    /// @notice Address of the CarbonRetirement contract (sole minter)
    address public retirementContract;

    /// @notice Whether soulbound mode is enabled (prevents transfers)
    bool public soulbound;

    /// @notice Auto-incrementing token ID counter
    uint256 private _nextTokenId;

    /// @notice Mapping of token ID to certificate data
    mapping(uint256 => CertificateData) private _certificates;

    /// @notice Total certificates minted
    uint256 private _totalCertificates;

    /// @notice Contract version for upgrade tracking
    string public constant VERSION = "1.0.0";

    // ============ Errors ============

    error OnlyRetirementContract();
    error SoulboundTransferBlocked();
    error InvalidRetirementContract();
    error TokenDoesNotExist();

    // ============ Modifiers ============

    modifier onlyRetirementContract() {
        if (msg.sender != retirementContract) revert OnlyRetirementContract();
        _;
    }

    // ============ Initialization ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param _retirementContract Address of the CarbonRetirement contract
     * @param _owner Address of the contract owner
     */
    function initialize(
        address _retirementContract,
        address _owner
    ) public initializer {
        if (_retirementContract == address(0)) revert InvalidRetirementContract();

        __ERC721_init("TerraQura Retirement Certificate", "TQRC");
        __ERC721Enumerable_init();
        __Ownable_init();
        if (_owner != msg.sender) {
            _transferOwnership(_owner);
        }
        __Pausable_init();
        __UUPSUpgradeable_init();

        retirementContract = _retirementContract;
        _nextTokenId = 1;
        soulbound = false;
    }

    // ============ External Functions ============

    /**
     * @inheritdoc IRetirementCertificate
     */
    function mint(
        address to,
        uint256 retirementId,
        CertificateData calldata data
    ) external override onlyRetirementContract whenNotPaused returns (uint256 tokenId) {
        tokenId = _nextTokenId++;

        _safeMint(to, tokenId);

        _certificates[tokenId] = CertificateData({
            retirementId: retirementId,
            creditId: data.creditId,
            amount: data.amount,
            beneficiary: data.beneficiary,
            reason: data.reason,
            timestamp: data.timestamp,
            methodology: data.methodology,
            vintage: data.vintage
        });

        _totalCertificates++;

        emit CertificateMinted(tokenId, retirementId, to);
    }

    /**
     * @notice Returns fully on-chain base64-encoded JSON metadata
     * @param tokenId The token ID
     * @return Base64-encoded JSON metadata URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert TokenDoesNotExist();

        CertificateData memory cert = _certificates[tokenId];

        string memory json = string(
            abi.encodePacked(
                '{"name":"TerraQura Retirement Certificate #',
                tokenId.toString(),
                '","description":"Proof of permanent carbon credit retirement on the TerraQura platform."',
                ',"attributes":[',
                _buildAttributes(cert),
                "]}"
            )
        );

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            )
        );
    }

    /**
     * @inheritdoc IRetirementCertificate
     */
    function getCertificateData(uint256 tokenId) external view override returns (CertificateData memory) {
        if (!_exists(tokenId)) revert TokenDoesNotExist();
        return _certificates[tokenId];
    }

    /**
     * @inheritdoc IRetirementCertificate
     */
    function setSoulbound(bool enabled) external override onlyOwner {
        soulbound = enabled;
    }

    /**
     * @inheritdoc IRetirementCertificate
     */
    function totalCertificates() external view override returns (uint256) {
        return _totalCertificates;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the retirement contract address
     * @param _retirementContract New retirement contract address
     */
    function setRetirementContract(address _retirementContract) external onlyOwner {
        if (_retirementContract == address(0)) revert InvalidRetirementContract();
        retirementContract = _retirementContract;
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Internal Functions ============

    /**
     * @notice Build JSON attributes array for token metadata
     * @param cert The certificate data
     * @return JSON attributes string
     */
    function _buildAttributes(CertificateData memory cert) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '{"trait_type":"Retirement ID","value":"', cert.retirementId.toString(), '"}',
                ',{"trait_type":"Credit ID","value":"', cert.creditId.toString(), '"}',
                ',{"trait_type":"Amount (tonnes CO2)","value":"', cert.amount.toString(), '"}',
                ',{"trait_type":"Beneficiary","value":"', cert.beneficiary, '"}',
                ',{"trait_type":"Reason","value":"', cert.reason, '"}',
                ',{"trait_type":"Timestamp","value":"', cert.timestamp.toString(), '"}',
                ',{"trait_type":"Methodology","value":"', cert.methodology, '"}',
                ',{"trait_type":"Vintage","value":"', cert.vintage, '"}'
            )
        );
    }

    /**
     * @notice Hook to enforce soulbound behavior
     * @dev Blocks transfers when soulbound is enabled, except for minting (from == address(0))
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        if (soulbound && from != address(0)) {
            revert SoulboundTransferBlocked();
        }
    }

    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @param newImplementation Address of new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Required override for ERC721Enumerable
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
