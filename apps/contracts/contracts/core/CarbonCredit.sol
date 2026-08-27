// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/ICarbonCredit.sol";
import "../interfaces/ICircuitBreaker.sol";
import "../interfaces/IVerificationEngine.sol";

/**
 * @title CarbonCredit
 * @author TerraQura
 * @notice ERC-1155 token representing verified carbon credits from DAC facilities
 * @dev Uses UUPS proxy pattern for upgradeability
 *
 * Each token ID represents a unique batch of carbon credits from a specific
 * capture event. The token ID is derived from:
 * - DAC unit ID
 * - Capture timestamp
 * - Source data hash
 *
 * This ensures each batch is uniquely identifiable and traceable back to
 * the original carbon capture event.
 */
contract CarbonCredit is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    ICarbonCredit
{
    // ============ State Variables ============

    /**
     * @notice Reference to the verification engine contract
     */
    IVerificationEngine public verificationEngine;

    /**
     * @notice Mapping of token ID to credit metadata
     */
    mapping(uint256 => CreditMetadata) private _creditMetadata;

    /**
     * @notice Mapping of token ID to verification results
     */
    mapping(uint256 => VerificationResult) private _verificationResults;

    /**
     * @notice Mapping of source data hashes to prevent double-minting
     */
    mapping(bytes32 => bool) public usedDataHashes;

    /**
     * @notice Total credits minted across all token IDs
     */
    uint256 private _totalCreditsMinted;

    /**
     * @notice Total credits retired across all token IDs
     */
    uint256 private _totalCreditsRetired;

    /**
     * @notice Mapping of approved minters (operators)
     */
    mapping(address => bool) public approvedMinters;

    /**
     * @notice Contract version for upgrade tracking
     */
    string public constant VERSION = "3.0.0";

    /**
     * @notice Scaling factor matching verification engine
     */
    uint256 public constant SCALE = 10000;

    // ============ Buffer Pool State Variables ============

    /**
     * @notice Address of the buffer pool reserve (receives withheld credits)
     * @dev Set to address(0) to disable buffer pool functionality
     */
    address public bufferPoolAddress;

    /**
     * @notice Buffer pool withholding percentage in basis points (100 = 1%)
     * @dev Range: 0-1000 (0% to 10% max). Applied during minting.
     */
    uint256 public bufferPercentageBps;

    /**
     * @notice Maximum buffer percentage (10%)
     */
    uint256 public constant MAX_BUFFER_BPS = 1000;

    /**
     * @notice Total credits held in buffer pool across all tokens
     */
    uint256 public totalBufferPoolCredits;

    /**
     * @notice Per-token buffer pool balance tracking
     */
    mapping(uint256 => uint256) public bufferPoolBalance;

    /**
     * @notice Per-token total supply tracking (minted - burned)
     */
    mapping(uint256 => uint256) private _tokenTotalSupply;

    /**
     * @notice Circuit breaker emergency control
     */
    ICircuitBreaker public circuitBreaker;

    // ============ Events ============

    /**
     * @notice Emitted when a minter is approved or revoked
     */
    event MinterUpdated(address indexed minter, bool approved);

    /**
     * @notice Emitted when verification engine is updated
     */
    event VerificationEngineUpdated(address indexed oldEngine, address indexed newEngine);

    /**
     * @notice Emitted when buffer pool configuration is updated
     */
    event BufferPoolConfigured(
        address indexed oldAddress,
        address indexed newAddress,
        uint256 oldPercentage,
        uint256 newPercentage
    );

    /**
     * @notice Emitted when credits are allocated to the buffer pool
     */
    event BufferPoolAllocation(
        uint256 indexed tokenId,
        uint256 operatorAmount,
        uint256 bufferAmount,
        uint256 totalMinted
    );

    /**
     * @notice Emitted when buffer credits are released back to circulation
     */
    event BufferPoolRelease(
        uint256 indexed tokenId,
        address indexed releasedTo,
        uint256 amount,
        string reason
    );

    /**
     * @notice Emitted when a carbon reversal is detected and buffer credits are burned
     * @dev This is the critical anti-reversal mechanism for permanence guarantees
     */
    event CarbonReversalHandled(
        uint256 indexed tokenId,
        uint256 amountBurned,
        uint256 remainingBuffer,
        string reason,
        uint256 timestamp
    );

    event CircuitBreakerUpdated(address indexed previousCircuitBreaker, address indexed newCircuitBreaker);

    // ============ Errors ============

    error UnauthorizedMinter();
    error DataHashAlreadyUsed();
    error VerificationFailed(string phase);
    error InsufficientBalance();
    error CreditAlreadyRetired();
    error InvalidVerificationEngine();
    error EmptyMetadataUri();
    error InvalidBufferPercentage();
    error InvalidBufferPoolAddress();
    error InsufficientBufferBalance();
    error ReversalAmountExceedsBuffer();
    error InvalidReversalAmount();
    error InvalidCircuitBreaker();
    error CircuitBreakerBlocked();
    error CircuitBreakerRateLimited();
    error CircuitBreakerVolumeExceeded();

    // ============ Modifiers ============

    /**
     * @notice Restricts minting to approved operators
     */
    modifier onlyMinter() {
        if (!approvedMinters[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedMinter();
        }
        _;
    }

    // ============ Initialization ============

    /**
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (called once during deployment)
     * @param _verificationEngine Address of the verification engine
     * @param _uri Base URI for token metadata
     * @param _owner Address of the contract owner (multi-sig)
     */
    function initialize(
        address _verificationEngine,
        string memory _uri,
        address _owner
    ) public initializer {
        if (_verificationEngine == address(0)) {
            revert InvalidVerificationEngine();
        }

        __ERC1155_init(_uri);
       __Ownable_init();
if (_owner != msg.sender) {
    _transferOwnership(_owner);
}
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        verificationEngine = IVerificationEngine(_verificationEngine);
    }

    // ============ External Functions ============

    /**
     * @inheritdoc ICarbonCredit
     * @dev v3.0.0: Now accepts gridIntensityGCO2PerKwh for Net-Negative Accounting.
     *      Grid intensity represents the carbon footprint of the electricity used
     *      by the capture facility (e.g., 50 for solar, 400 for coal grid).
     */
    function mintVerifiedCredits(
        address to,
        bytes32 dacUnitId,
        bytes32 sourceDataHash,
        uint256 captureTimestamp,
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        int256 latitude,
        int256 longitude,
        uint8 purityPercentage,
        uint256 gridIntensityGCO2PerKwh,
        string calldata ipfsMetadataUri,
        string calldata arweaveBackupTxId
    )
        external
        override
        onlyMinter
        whenNotPaused
        nonReentrant
        returns (uint256 tokenId)
    {
        _enforceCircuitBreakerPreflight();

        // Validate inputs
        if (bytes(ipfsMetadataUri).length == 0) {
            revert EmptyMetadataUri();
        }

        // Check for duplicate data hash
        if (usedDataHashes[sourceDataHash]) {
            revert DataHashAlreadyUsed();
        }

        // Generate unique token ID
        tokenId = _generateTokenId(dacUnitId, captureTimestamp, sourceDataHash);

        // Run three-phase verification with Net-Negative grid intensity
        (
            bool sourceVerified,
            bool logicVerified,
            bool mintVerified,
            uint256 efficiencyFactor
        ) = verificationEngine.verify(
            dacUnitId,
            sourceDataHash,
            co2AmountKg,
            energyConsumedKwh,
            purityPercentage,
            gridIntensityGCO2PerKwh
        );

        // Check verification results
        if (!sourceVerified) {
            revert VerificationFailed("SOURCE");
        }
        if (!logicVerified) {
            revert VerificationFailed("LOGIC");
        }
        // Note: mintVerified check removed as dead code.
        // The usedDataHashes check prevents duplicate hashes BEFORE
        // calling VerificationEngine.verify(). Since VerificationEngine.verify()
        // is only callable by this contract (onlyCarbonCredit modifier), and both
        // usedDataHashes and _processedHashes are updated atomically on successful
        // mints, mintVerified will always be true when we reach this point.
        assert(mintVerified); // Invariant: should always be true due to architecture

        // Calculate adjusted credit amount based on Net-Negative efficiency factor
        uint256 creditsToMint = (co2AmountKg * efficiencyFactor) / SCALE;

        _enforceCircuitBreakerVolume(creditsToMint);

        // Store metadata (v3.0.0: includes gridIntensity)
        _creditMetadata[tokenId] = CreditMetadata({
            dacUnitId: dacUnitId,
            sourceDataHash: sourceDataHash,
            captureTimestamp: captureTimestamp,
            co2AmountKg: co2AmountKg,
            energyConsumedKwh: energyConsumedKwh,
            latitude: latitude,
            longitude: longitude,
            purityPercentage: purityPercentage,
            gridIntensityGCO2PerKwh: gridIntensityGCO2PerKwh,
            isRetired: false,
            ipfsMetadataUri: ipfsMetadataUri,
            arweaveBackupTxId: arweaveBackupTxId
        });

        // Store verification results
        _verificationResults[tokenId] = VerificationResult({
            sourceVerified: sourceVerified,
            logicVerified: logicVerified,
            mintVerified: mintVerified,
            efficiencyFactor: efficiencyFactor,
            verifiedAt: block.timestamp
        });

        // Mark data hash as used
        usedDataHashes[sourceDataHash] = true;

        // Buffer Pool split: withhold a percentage for carbon reversal risk reserve
        uint256 bufferAmount = 0;
        uint256 operatorAmount = creditsToMint;

        if (bufferPoolAddress != address(0) && bufferPercentageBps > 0) {
            bufferAmount = (creditsToMint * bufferPercentageBps) / SCALE;
            operatorAmount = creditsToMint - bufferAmount;

            // Mint operator's share
            _mint(to, tokenId, operatorAmount, "");

            // Mint buffer pool's share to reserve address
            _mint(bufferPoolAddress, tokenId, bufferAmount, "");

            // Track buffer pool balances
            bufferPoolBalance[tokenId] += bufferAmount;
            totalBufferPoolCredits += bufferAmount;

            emit BufferPoolAllocation(tokenId, operatorAmount, bufferAmount, creditsToMint);
        } else {
            // No buffer pool configured - mint all to operator
            _mint(to, tokenId, creditsToMint, "");
        }

        // Update totals (track full amount including buffer)
        _totalCreditsMinted += creditsToMint;
        _tokenTotalSupply[tokenId] += creditsToMint;

        // Emit events
        emit CreditMinted(tokenId, dacUnitId, to, operatorAmount, sourceDataHash);
        emit VerificationCompleted(
            tokenId,
            sourceVerified,
            logicVerified,
            mintVerified,
            efficiencyFactor
        );

        return tokenId;
    }

    /**
     * @inheritdoc ICarbonCredit
     */
    function retireCredits(
        uint256 tokenId,
        uint256 amount,
        string calldata reason
    ) external override whenNotPaused nonReentrant {
        _enforceCircuitBreaker(amount);

        // Check balance
        if (balanceOf(msg.sender, tokenId) < amount) {
            revert InsufficientBalance();
        }

        // Burn the tokens (permanent retirement)
        _burn(msg.sender, tokenId, amount);

        // Update totals
        _totalCreditsRetired += amount;
        _tokenTotalSupply[tokenId] -= amount;

        // Mark as fully retired if no balance remaining
        if (balanceOf(msg.sender, tokenId) == 0) {
            _creditMetadata[tokenId].isRetired = true;
        }

        emit CreditRetired(tokenId, msg.sender, amount, reason);
    }

    /**
     * @inheritdoc ICarbonCredit
     */
    function getCreditProvenance(uint256 tokenId)
        external
        view
        override
        returns (CreditMetadata memory metadata, VerificationResult memory verification)
    {
        return (_creditMetadata[tokenId], _verificationResults[tokenId]);
    }

    /**
     * @inheritdoc ICarbonCredit
     */
    function totalCreditsMinted() external view override returns (uint256) {
        return _totalCreditsMinted;
    }

    /**
     * @inheritdoc ICarbonCredit
     */
    function totalCreditsRetired() external view override returns (uint256) {
        return _totalCreditsRetired;
    }

    /**
     * @notice Get the metadata for a specific token
     * @param tokenId The token ID to query
     * @return The credit metadata
     */
    function getMetadata(uint256 tokenId) external view returns (CreditMetadata memory) {
        return _creditMetadata[tokenId];
    }

    /**
     * @notice Get the verification result for a specific token
     * @param tokenId The token ID to query
     * @return The verification result
     */
    function getVerificationResult(uint256 tokenId) external view returns (VerificationResult memory) {
        return _verificationResults[tokenId];
    }

    /**
     * @notice Returns the URI for a token ID
     * @param tokenId The token ID
     * @return The IPFS URI for the token metadata
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory ipfsUri = _creditMetadata[tokenId].ipfsMetadataUri;
        if (bytes(ipfsUri).length > 0) {
            return ipfsUri;
        }
        return super.uri(tokenId);
    }

    // ============ Admin Functions ============

    /**
     * @notice Approve or revoke a minter
     * @param minter Address to update
     * @param approved Whether to approve or revoke
     */
    function setMinter(address minter, bool approved) external onlyOwner {
        approvedMinters[minter] = approved;
        emit MinterUpdated(minter, approved);
    }

    /**
     * @notice Update the verification engine address
     * @param _verificationEngine New verification engine address
     */
    function setVerificationEngine(address _verificationEngine) external onlyOwner {
        if (_verificationEngine == address(0)) {
            revert InvalidVerificationEngine();
        }

        address oldEngine = address(verificationEngine);
        verificationEngine = IVerificationEngine(_verificationEngine);

        emit VerificationEngineUpdated(oldEngine, _verificationEngine);
    }

    /**
     * @notice Configure the circuit breaker contract used for runtime safety checks
     */
    function setCircuitBreaker(address newCircuitBreaker) external onlyOwner {
        if (newCircuitBreaker == address(0)) {
            revert InvalidCircuitBreaker();
        }

        address previousCircuitBreaker = address(circuitBreaker);
        circuitBreaker = ICircuitBreaker(newCircuitBreaker);

        emit CircuitBreakerUpdated(previousCircuitBreaker, newCircuitBreaker);
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

    /**
     * @notice Set the base URI for all tokens
     * @param newUri New base URI
     */
    function setBaseUri(string memory newUri) external onlyOwner {
        _setURI(newUri);
    }

    /**
     * @notice Configure the buffer pool for carbon reversal risk management
     * @dev Buffer pool withholds a percentage of minted credits as insurance against
     *      carbon reversal events (e.g., storage leaks, facility failures).
     *      Set _bufferPoolAddress to address(0) to disable.
     * @param _bufferPoolAddress Address to receive buffer pool credits
     * @param _bufferPercentageBps Withholding percentage in basis points (max 1000 = 10%)
     */
    function setBufferConfiguration(
        address _bufferPoolAddress,
        uint256 _bufferPercentageBps
    ) external onlyOwner {
        if (_bufferPercentageBps > MAX_BUFFER_BPS) {
            revert InvalidBufferPercentage();
        }
        // If percentage > 0, address must be set
        if (_bufferPercentageBps > 0 && _bufferPoolAddress == address(0)) {
            revert InvalidBufferPoolAddress();
        }

        address oldAddress = bufferPoolAddress;
        uint256 oldPercentage = bufferPercentageBps;

        bufferPoolAddress = _bufferPoolAddress;
        bufferPercentageBps = _bufferPercentageBps;

        emit BufferPoolConfigured(oldAddress, _bufferPoolAddress, oldPercentage, _bufferPercentageBps);
    }

    /**
     * @notice Release buffer pool credits back to circulation
     * @dev Used when a verification period has passed and the carbon capture is confirmed permanent.
     *      Only the owner (multi-sig) can authorize buffer releases.
     * @param tokenId The token ID to release buffer credits for
     * @param amount Number of credits to release from buffer
     * @param releaseTo Address to receive the released credits
     * @param reason Reason for the release (e.g., "Verification period complete")
     */
    function releaseBufferCredits(
        uint256 tokenId,
        uint256 amount,
        address releaseTo,
        string calldata reason
    ) external onlyOwner whenNotPaused nonReentrant {
        _enforceCircuitBreaker(amount);

        if (amount == 0) revert InsufficientBalance();
        if (bufferPoolBalance[tokenId] < amount) {
            revert InsufficientBufferBalance();
        }
        if (releaseTo == address(0)) revert InvalidBufferPoolAddress();

        // Transfer from buffer pool to release target
        _safeTransferFrom(bufferPoolAddress, releaseTo, tokenId, amount, "");

        // Update buffer tracking
        bufferPoolBalance[tokenId] -= amount;
        totalBufferPoolCredits -= amount;

        emit BufferPoolRelease(tokenId, releaseTo, amount, reason);
    }

    /**
     * @notice Handle a detected carbon reversal by burning buffer pool credits
     * @dev Triggered when MRV monitoring detects a carbon reversal event (e.g.,
     *      storage leak, facility failure, permanence breach). Burns credits from
     *      the buffer pool reserve to compensate for the loss and maintain the
     *      integrity of circulating credits.
     *
     *      This is the critical anti-reversal mechanism that protects institutional
     *      buyers from permanence risk. The buffer pool acts as insurance - when a
     *      reversal occurs, corresponding credits are permanently destroyed.
     *
     *      Only callable by the contract owner (multi-sig governance) to prevent abuse.
     *      The function is pausable for emergency scenarios.
     *
     * @param tokenId The token ID affected by the reversal
     * @param amountToBurn Number of buffer credits to burn (matching reversed CO2)
     * @param reason Detailed reason for the reversal (e.g., "Storage leak detected at facility XYZ")
     */
    function handleReversal(
        uint256 tokenId,
        uint256 amountToBurn,
        string calldata reason
    ) external onlyOwner whenNotPaused nonReentrant {
        _enforceCircuitBreaker(amountToBurn);

        if (amountToBurn == 0) revert InvalidReversalAmount();
        if (bufferPoolBalance[tokenId] < amountToBurn) {
            revert ReversalAmountExceedsBuffer();
        }
        if (bufferPoolAddress == address(0)) revert InvalidBufferPoolAddress();

        // Burn credits from the buffer pool reserve
        _burn(bufferPoolAddress, tokenId, amountToBurn);

        // Update buffer tracking
        bufferPoolBalance[tokenId] -= amountToBurn;
        totalBufferPoolCredits -= amountToBurn;

        // Update total supply tracking
        _tokenTotalSupply[tokenId] -= amountToBurn;

        emit CarbonReversalHandled(
            tokenId,
            amountToBurn,
            bufferPoolBalance[tokenId],
            reason,
            block.timestamp
        );
    }

    /**
     * @notice Get buffer pool statistics
     * @return poolAddress Current buffer pool address
     * @return percentageBps Current withholding percentage
     * @return totalHeld Total credits held across all tokens
     */
    function getBufferPoolStats()
        external
        view
        returns (address poolAddress, uint256 percentageBps, uint256 totalHeld)
    {
        return (bufferPoolAddress, bufferPercentageBps, totalBufferPoolCredits);
    }

    /**
     * @notice Get buffer pool balance for a specific token
     * @param tokenId Token ID to query
     * @return amount Credits held in buffer for this token
     */
    function getBufferBalance(uint256 tokenId) external view returns (uint256) {
        return bufferPoolBalance[tokenId];
    }

    // ============ Internal Functions ============

    /**
     * @notice Generate a unique token ID
     * @param dacUnitId The DAC facility ID
     * @param captureTimestamp The capture timestamp
     * @param sourceDataHash The source data hash
     * @return The generated token ID
     */
    function _generateTokenId(
        bytes32 dacUnitId,
        uint256 captureTimestamp,
        bytes32 sourceDataHash
    ) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(dacUnitId, captureTimestamp, sourceDataHash)));
    }

    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @param newImplementation Address of new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function _enforceCircuitBreakerPreflight() internal {
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
    }

    function _enforceCircuitBreakerVolume(uint256 volume) internal {
        address breaker = address(circuitBreaker);
        if (breaker == address(0) || volume == 0) {
            return;
        }

        if (!circuitBreaker.checkVolumeLimit(address(this), volume)) {
            revert CircuitBreakerVolumeExceeded();
        }
    }

    function _enforceCircuitBreaker(uint256 volume) internal {
        _enforceCircuitBreakerPreflight();
        _enforceCircuitBreakerVolume(volume);
    }

    // ============ View Functions ============

    /**
     * @notice Check if an address is an approved minter
     * @param account Address to check
     * @return Whether the address is approved
     */
    function isMinter(address account) external view returns (bool) {
        return approvedMinters[account] || account == owner();
    }

    /**
     * @notice Get the total supply of a specific token
     * @dev Tracks minted minus burned per token ID
     * @param tokenId The token ID to query
     * @return Current total supply for this token
     */
    function totalSupply(uint256 tokenId) external view returns (uint256) {
        return _tokenTotalSupply[tokenId];
    }

    /**
     * @notice Check if a token exists (has been minted)
     * @param tokenId The token ID to check
     * @return Whether the token exists
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return _creditMetadata[tokenId].captureTimestamp > 0;
    }

    /**
     * @notice Get contract version
     * @dev v3.1.0: Added batch operations for gas optimization
     *      v3.0.0: Added Net-Negative Verification, grid intensity tracking
     *      v2.0.0: Added Buffer Pool, per-token supply tracking (audit recommendation)
     * @return The version string
     */
    function version() external pure returns (string memory) {
        return VERSION;
    }

    // ============ Batch Operations (Gas Optimization) ============

    /**
     * @notice Batch retire multiple credits in a single transaction
     * @dev Gas optimization: Amortizes base transaction cost (~21,000 gas) across multiple retirements.
     *      Typical savings: ~40% gas per retirement when batching 10+ retirements.
     *
     *      Security: Each retirement is validated independently. If any single retirement
     *      fails (e.g., insufficient balance), the entire batch reverts.
     *
     * @param tokenIds Array of token IDs to retire
     * @param amounts Array of amounts to retire (must match tokenIds length)
     * @param reason Common retirement reason for all credits
     */
    function batchRetireCredits(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        string calldata reason
    ) external whenNotPaused nonReentrant {
        uint256 len = tokenIds.length;
        require(len == amounts.length, "Length mismatch");
        require(len > 0 && len <= 100, "Invalid batch size");

        address sender = msg.sender;
        uint256 totalRetired = 0;

        for (uint256 i = 0; i < len; ) {
            unchecked {
                totalRetired += amounts[i];
                ++i;
            }
        }

        _enforceCircuitBreaker(totalRetired);

        totalRetired = 0;

        for (uint256 i = 0; i < len; ) {
            uint256 tokenId = tokenIds[i];
            uint256 amount = amounts[i];

            // Check balance
            if (balanceOf(sender, tokenId) < amount) {
                revert InsufficientBalance();
            }

            // Burn the tokens (permanent retirement)
            _burn(sender, tokenId, amount);

            // Update per-token supply
            _tokenTotalSupply[tokenId] -= amount;

            // Track total for aggregate update
            unchecked {
                totalRetired += amount;
            }

            // Mark as fully retired if no balance remaining
            if (balanceOf(sender, tokenId) == 0) {
                _creditMetadata[tokenId].isRetired = true;
            }

            emit CreditRetired(tokenId, sender, amount, reason);

            unchecked { ++i; }
        }

        // Aggregate total update (gas optimization: single SSTORE for total)
        _totalCreditsRetired += totalRetired;
    }

    /**
     * @notice Get credit info for multiple token IDs in a single call
     * @dev Gas optimization for frontends: Reduces RPC calls when loading multiple credits.
     * @param tokenIds Array of token IDs to query
     * @return metadataArray Array of credit metadata
     * @return verificationArray Array of verification results
     */
    function batchGetCreditProvenance(
        uint256[] calldata tokenIds
    ) external view returns (
        CreditMetadata[] memory metadataArray,
        VerificationResult[] memory verificationArray
    ) {
        uint256 len = tokenIds.length;
        require(len <= 100, "Batch too large");

        metadataArray = new CreditMetadata[](len);
        verificationArray = new VerificationResult[](len);

        for (uint256 i = 0; i < len; ) {
            metadataArray[i] = _creditMetadata[tokenIds[i]];
            verificationArray[i] = _verificationResults[tokenIds[i]];
            unchecked { ++i; }
        }
    }

    /**
     * @notice Get balances for multiple token IDs for an address
     * @dev Gas optimization: Single call for portfolio view
     * @param account Address to check balances for
     * @param tokenIds Array of token IDs to query
     * @return balances Array of balances
     */
    function batchBalanceOf(
        address account,
        uint256[] calldata tokenIds
    ) external view returns (uint256[] memory balances) {
        uint256 len = tokenIds.length;
        require(len <= 200, "Batch too large");

        balances = new uint256[](len);

        for (uint256 i = 0; i < len; ) {
            balances[i] = balanceOf(account, tokenIds[i]);
            unchecked { ++i; }
        }
    }
}
