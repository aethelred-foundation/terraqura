// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title TerraQuraMultisigMainnet
 * @author TerraQura
 * @notice Production-hardened 3-of-5 multisig for mainnet deployment
 * @dev CRITICAL: This contract MUST be deployed with hardware wallet signers
 *
 * Mainnet Requirements:
 * - Minimum 5 signers (geographically distributed)
 * - Minimum 3-of-5 threshold
 * - Hardware wallets ONLY (Ledger/Trezor)
 * - 72-hour default transaction expiry (reduced attack window)
 *
 * Changes from testnet version:
 * - MIN_THRESHOLD raised to 3
 * - MIN_SIGNERS raised to 5
 * - DEFAULT_EXPIRY reduced to 72 hours
 * - Added signer location metadata for geographic distribution tracking
 * - Added hardware wallet attestation support
 * - Added emergency recovery delay (7 days)
 */
contract TerraQuraMultisigMainnet is EIP712 {
    using ECDSA for bytes32;

    // ============ Structs ============

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
        uint256 createdAt;
        uint256 expiresAt;
        string description; // Human-readable description for audit
    }

    struct SignerInfo {
        bool isActive;
        string countryCode;      // ISO 3166-1 alpha-2 (e.g., "AE", "US", "CH")
        string walletType;       // "LEDGER" or "TREZOR"
        uint256 addedAt;
        address addedBy;
    }

    // ============ Constants ============

    /// @notice Minimum threshold for mainnet (3-of-5)
    uint256 public constant MIN_THRESHOLD = 3;

    /// @notice Minimum signers for mainnet (5)
    uint256 public constant MIN_SIGNERS = 5;

    /// @notice Maximum signers
    uint256 public constant MAX_SIGNERS = 10;

    /// @notice Default transaction expiry (72 hours - reduced attack window)
    uint256 public constant DEFAULT_EXPIRY = 72 hours;

    /// @notice Maximum transaction expiry (7 days)
    uint256 public constant MAX_EXPIRY = 7 days;

    /// @notice Minimum transaction expiry (24 hours - mainnet safety)
    uint256 public constant MIN_EXPIRY = 24 hours;

    /// @notice Emergency recovery delay (7 days)
    uint256 public constant EMERGENCY_RECOVERY_DELAY = 7 days;

    /// @notice EIP-712 type hash for transaction
    bytes32 public constant TRANSACTION_TYPEHASH = keccak256(
        "Transaction(address to,uint256 value,bytes data,uint256 nonce,uint256 deadline,string description)"
    );

    // ============ State Variables ============

    /// @notice List of signers
    address[] public signers;

    /// @notice Mapping of signer address to info
    mapping(address => SignerInfo) public signerInfo;

    /// @notice Number of required confirmations
    uint256 public threshold;

    /// @notice Transaction nonce
    uint256 public nonce;

    /// @notice Mapping of transaction ID to Transaction
    mapping(uint256 => Transaction) public transactions;

    /// @notice Mapping of transaction ID to signer to confirmation status
    mapping(uint256 => mapping(address => bool)) public confirmations;

    /// @notice Emergency recovery initiation timestamp (0 if not initiated)
    uint256 public emergencyRecoveryInitiated;

    /// @notice Pending emergency recovery threshold
    uint256 public pendingEmergencyThreshold;

    /// @notice Pending emergency recovery signers
    address[] public pendingEmergencySigners;

    // ============ Events ============

    event TransactionSubmitted(
        uint256 indexed txId,
        address indexed submitter,
        address to,
        uint256 value,
        bytes data,
        string description
    );

    event TransactionConfirmed(
        uint256 indexed txId,
        address indexed signer,
        uint256 confirmationCount
    );

    event TransactionRevoked(
        uint256 indexed txId,
        address indexed signer,
        uint256 confirmationCount
    );

    event TransactionExecuted(
        uint256 indexed txId,
        address indexed executor,
        bool success
    );

    event TransactionFailed(
        uint256 indexed txId,
        string reason
    );

    event SignerAdded(
        address indexed signer,
        string countryCode,
        string walletType,
        address indexed addedBy
    );

    event SignerRemoved(
        address indexed signer,
        address indexed removedBy
    );

    event ThresholdChanged(
        uint256 oldThreshold,
        uint256 newThreshold
    );

    event EmergencyRecoveryInitiated(
        address indexed initiator,
        uint256 executeAfter
    );

    event EmergencyRecoveryCancelled(
        address indexed canceller
    );

    event EmergencyRecoveryExecuted(
        address indexed executor,
        uint256 newThreshold,
        uint256 newSignerCount
    );

    // ============ Errors ============

    error NotSigner();
    error InvalidThreshold();
    error InvalidSigner();
    error SignerAlreadyExists();
    error SignerDoesNotExist();
    error TransactionDoesNotExist();
    error TransactionAlreadyExecuted();
    error TransactionExpired();
    error TransactionNotConfirmed();
    error AlreadyConfirmed();
    error NotConfirmed();
    error ExecutionFailed();
    error CannotRemoveLastSigner();
    error InsufficientSigners();
    error InvalidWalletType();
    error InvalidCountryCode();
    error InsufficientGeographicDistribution();
    error EmergencyRecoveryNotInitiated();
    error EmergencyRecoveryDelayNotPassed();
    error EmergencyRecoveryAlreadyInitiated();

    // ============ Modifiers ============

    modifier onlySigner() {
        if (!signerInfo[msg.sender].isActive) revert NotSigner();
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "Only via multisig");
        _;
    }

    modifier txExists(uint256 txId) {
        if (transactions[txId].to == address(0)) revert TransactionDoesNotExist();
        _;
    }

    modifier notExecuted(uint256 txId) {
        if (transactions[txId].executed) revert TransactionAlreadyExecuted();
        _;
    }

    modifier notExpired(uint256 txId) {
        if (block.timestamp > transactions[txId].expiresAt) revert TransactionExpired();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initialize the mainnet multisig
     * @param _signers Initial list of 5 signers
     * @param _countryCodes ISO 3166-1 alpha-2 codes for each signer
     * @param _walletTypes "LEDGER" or "TREZOR" for each signer
     * @param _threshold Required confirmations (minimum 3)
     */
    constructor(
        address[] memory _signers,
        string[] memory _countryCodes,
        string[] memory _walletTypes,
        uint256 _threshold
    ) EIP712("TerraQuraMultisigMainnet", "1") {
        require(_signers.length >= MIN_SIGNERS, "Need at least 5 signers");
        require(_signers.length <= MAX_SIGNERS, "Too many signers");
        require(_threshold >= MIN_THRESHOLD, "Threshold must be >= 3");
        require(_threshold <= _signers.length, "Threshold exceeds signers");
        require(_signers.length == _countryCodes.length, "Country codes mismatch");
        require(_signers.length == _walletTypes.length, "Wallet types mismatch");

        // Validate geographic distribution (at least 3 unique countries)
        _validateGeographicDistribution(_countryCodes);

        for (uint256 i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            require(signer != address(0), "Invalid signer");
            require(!signerInfo[signer].isActive, "Duplicate signer");

            // Validate wallet type
            bytes32 walletTypeHash = keccak256(bytes(_walletTypes[i]));
            require(
                walletTypeHash == keccak256("LEDGER") || walletTypeHash == keccak256("TREZOR"),
                "Invalid wallet type - must be LEDGER or TREZOR"
            );

            // Validate country code (2 characters)
            require(bytes(_countryCodes[i]).length == 2, "Invalid country code");

            signerInfo[signer] = SignerInfo({
                isActive: true,
                countryCode: _countryCodes[i],
                walletType: _walletTypes[i],
                addedAt: block.timestamp,
                addedBy: address(0) // Constructor
            });
            signers.push(signer);

            emit SignerAdded(signer, _countryCodes[i], _walletTypes[i], address(0));
        }

        threshold = _threshold;
    }

    // ============ Internal Validation ============

    function _validateGeographicDistribution(string[] memory countryCodes) internal pure {
        // Count unique countries
        uint256 uniqueCountries = 0;
        bytes32[] memory seen = new bytes32[](countryCodes.length);

        for (uint256 i = 0; i < countryCodes.length; i++) {
            bytes32 countryHash = keccak256(bytes(countryCodes[i]));
            bool isUnique = true;

            for (uint256 j = 0; j < uniqueCountries; j++) {
                if (seen[j] == countryHash) {
                    isUnique = false;
                    break;
                }
            }

            if (isUnique) {
                seen[uniqueCountries] = countryHash;
                uniqueCountries++;
            }
        }

        // Require at least 3 unique countries for geographic distribution
        require(uniqueCountries >= 3, "Insufficient geographic distribution - need 3+ countries");
    }

    // ============ Transaction Functions ============

    /**
     * @notice Submit a new transaction
     * @param to Target address
     * @param value ETH value
     * @param data Call data
     * @param description Human-readable description
     * @return txId Transaction ID
     */
    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        string calldata description
    ) external onlySigner returns (uint256 txId) {
        return _submitTransaction(to, value, data, DEFAULT_EXPIRY, description);
    }

    /**
     * @notice Submit a transaction with custom expiry
     * @param to Target address
     * @param value ETH value
     * @param data Call data
     * @param expiry Expiry duration in seconds
     * @param description Human-readable description
     * @return txId Transaction ID
     */
    function submitTransactionWithExpiry(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 expiry,
        string calldata description
    ) external onlySigner returns (uint256 txId) {
        require(expiry >= MIN_EXPIRY, "Expiry too short - minimum 24 hours");
        require(expiry <= MAX_EXPIRY, "Expiry too long - maximum 7 days");
        return _submitTransaction(to, value, data, expiry, description);
    }

    function _submitTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 expiry,
        string calldata description
    ) internal returns (uint256 txId) {
        txId = nonce++;

        transactions[txId] = Transaction({
            to: to,
            value: value,
            data: data,
            executed: false,
            confirmations: 0,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + expiry,
            description: description
        });

        emit TransactionSubmitted(txId, msg.sender, to, value, data, description);

        // Auto-confirm for submitter
        _confirmTransaction(txId);

        return txId;
    }

    /**
     * @notice Confirm a pending transaction
     * @param txId Transaction ID
     */
    function confirmTransaction(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
        notExpired(txId)
    {
        _confirmTransaction(txId);
    }

    function _confirmTransaction(uint256 txId) internal {
        if (confirmations[txId][msg.sender]) revert AlreadyConfirmed();

        confirmations[txId][msg.sender] = true;
        transactions[txId].confirmations++;

        emit TransactionConfirmed(txId, msg.sender, transactions[txId].confirmations);
    }

    /**
     * @notice Revoke confirmation for a transaction
     * @param txId Transaction ID
     */
    function revokeConfirmation(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
    {
        if (!confirmations[txId][msg.sender]) revert NotConfirmed();

        confirmations[txId][msg.sender] = false;
        transactions[txId].confirmations--;

        emit TransactionRevoked(txId, msg.sender, transactions[txId].confirmations);
    }

    /**
     * @notice Execute a confirmed transaction
     * @param txId Transaction ID
     */
    function executeTransaction(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
        notExpired(txId)
    {
        Transaction storage txn = transactions[txId];

        if (txn.confirmations < threshold) revert TransactionNotConfirmed();

        txn.executed = true;

        (bool success, bytes memory result) = txn.to.call{value: txn.value}(txn.data);

        if (!success) {
            // Revert with the error from the called contract
            if (result.length > 0) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
            revert ExecutionFailed();
        }

        emit TransactionExecuted(txId, msg.sender, success);
    }

    // ============ Signer Management (via multisig) ============

    /**
     * @notice Add a new signer (must be called via multisig)
     * @param signer Address to add
     * @param countryCode ISO 3166-1 alpha-2 country code
     * @param walletType "LEDGER" or "TREZOR"
     */
    function addSigner(
        address signer,
        string calldata countryCode,
        string calldata walletType
    ) external onlySelf {
        if (signer == address(0)) revert InvalidSigner();
        if (signerInfo[signer].isActive) revert SignerAlreadyExists();
        if (signers.length >= MAX_SIGNERS) revert InvalidThreshold();

        // Validate wallet type
        bytes32 walletTypeHash = keccak256(bytes(walletType));
        if (walletTypeHash != keccak256("LEDGER") && walletTypeHash != keccak256("TREZOR")) {
            revert InvalidWalletType();
        }

        // Validate country code
        if (bytes(countryCode).length != 2) revert InvalidCountryCode();

        signerInfo[signer] = SignerInfo({
            isActive: true,
            countryCode: countryCode,
            walletType: walletType,
            addedAt: block.timestamp,
            addedBy: msg.sender
        });
        signers.push(signer);

        emit SignerAdded(signer, countryCode, walletType, msg.sender);
    }

    /**
     * @notice Remove a signer (must be called via multisig)
     * @param signer Address to remove
     */
    function removeSigner(address signer) external onlySelf {
        if (!signerInfo[signer].isActive) revert SignerDoesNotExist();
        if (signers.length <= MIN_SIGNERS) revert InsufficientSigners();
        if (signers.length <= threshold) revert CannotRemoveLastSigner();

        signerInfo[signer].isActive = false;

        // Remove from array
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        emit SignerRemoved(signer, msg.sender);
    }

    /**
     * @notice Change the threshold (must be called via multisig)
     * @param newThreshold New required confirmations
     */
    function changeThreshold(uint256 newThreshold) external onlySelf {
        if (newThreshold < MIN_THRESHOLD) revert InvalidThreshold();
        if (newThreshold > signers.length) revert InvalidThreshold();

        uint256 oldThreshold = threshold;
        threshold = newThreshold;

        emit ThresholdChanged(oldThreshold, newThreshold);
    }

    // ============ Emergency Recovery ============

    /**
     * @notice Initiate emergency recovery (changes signers after 7-day delay)
     * @dev This is a last resort if signers lose access to hardware wallets
     * @param newSigners New signer addresses
     * @param newCountryCodes Country codes for new signers
     * @param newWalletTypes Wallet types for new signers
     * @param newThreshold New threshold
     */
    function initiateEmergencyRecovery(
        address[] calldata newSigners,
        string[] calldata newCountryCodes,
        string[] calldata newWalletTypes,
        uint256 newThreshold
    ) external onlySelf {
        if (emergencyRecoveryInitiated != 0) revert EmergencyRecoveryAlreadyInitiated();

        require(newSigners.length >= MIN_SIGNERS, "Need at least 5 signers");
        require(newCountryCodes.length == newSigners.length, "Country code count mismatch");
        require(newWalletTypes.length == newSigners.length, "Wallet type count mismatch");
        require(newThreshold >= MIN_THRESHOLD, "Threshold must be >= 3");
        require(newThreshold <= newSigners.length, "Threshold exceeds signers");

        // Store pending recovery data
        emergencyRecoveryInitiated = block.timestamp;
        pendingEmergencyThreshold = newThreshold;

        // Clear and set pending signers
        delete pendingEmergencySigners;
        for (uint256 i = 0; i < newSigners.length; i++) {
            pendingEmergencySigners.push(newSigners[i]);
        }

        emit EmergencyRecoveryInitiated(msg.sender, block.timestamp + EMERGENCY_RECOVERY_DELAY);
    }

    /**
     * @notice Cancel emergency recovery (before delay passes)
     */
    function cancelEmergencyRecovery() external onlySelf {
        if (emergencyRecoveryInitiated == 0) revert EmergencyRecoveryNotInitiated();

        emergencyRecoveryInitiated = 0;
        pendingEmergencyThreshold = 0;
        delete pendingEmergencySigners;

        emit EmergencyRecoveryCancelled(msg.sender);
    }

    /**
     * @notice Execute emergency recovery (after 7-day delay)
     */
    function executeEmergencyRecovery(
        string[] calldata newCountryCodes,
        string[] calldata newWalletTypes
    ) external onlySigner {
        if (emergencyRecoveryInitiated == 0) revert EmergencyRecoveryNotInitiated();
        if (block.timestamp < emergencyRecoveryInitiated + EMERGENCY_RECOVERY_DELAY) {
            revert EmergencyRecoveryDelayNotPassed();
        }

        require(
            pendingEmergencySigners.length == newCountryCodes.length &&
            pendingEmergencySigners.length == newWalletTypes.length,
            "Metadata length mismatch"
        );

        _validateGeographicDistribution(newCountryCodes);

        // Clear old signers
        for (uint256 i = 0; i < signers.length; i++) {
            signerInfo[signers[i]].isActive = false;
        }
        delete signers;

        // Add new signers
        for (uint256 i = 0; i < pendingEmergencySigners.length; i++) {
            address newSigner = pendingEmergencySigners[i];

            signerInfo[newSigner] = SignerInfo({
                isActive: true,
                countryCode: newCountryCodes[i],
                walletType: newWalletTypes[i],
                addedAt: block.timestamp,
                addedBy: msg.sender
            });
            signers.push(newSigner);

            emit SignerAdded(newSigner, newCountryCodes[i], newWalletTypes[i], msg.sender);
        }

        threshold = pendingEmergencyThreshold;

        // Clear recovery state
        uint256 newSignerCount = pendingEmergencySigners.length;
        emergencyRecoveryInitiated = 0;
        pendingEmergencyThreshold = 0;
        delete pendingEmergencySigners;

        emit EmergencyRecoveryExecuted(msg.sender, threshold, newSignerCount);
    }

    // ============ View Functions ============

    /**
     * @notice Get all signers
     */
    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    /**
     * @notice Get signer count
     */
    function getSignerCount() external view returns (uint256) {
        return signers.length;
    }

    /**
     * @notice Get signer info
     */
    function getSignerInfo(address signer) external view returns (
        bool isActive,
        string memory countryCode,
        string memory walletType,
        uint256 addedAt,
        address addedBy
    ) {
        SignerInfo storage info = signerInfo[signer];
        return (info.isActive, info.countryCode, info.walletType, info.addedAt, info.addedBy);
    }

    /**
     * @notice Get transaction details
     */
    function getTransaction(uint256 txId) external view returns (
        address to,
        uint256 value,
        bytes memory data,
        bool executed,
        uint256 numConfirmations,
        uint256 expiresAt,
        bool canExecute,
        string memory description
    ) {
        Transaction storage txn = transactions[txId];
        return (
            txn.to,
            txn.value,
            txn.data,
            txn.executed,
            txn.confirmations,
            txn.expiresAt,
            txn.confirmations >= threshold && !txn.executed && block.timestamp <= txn.expiresAt,
            txn.description
        );
    }

    /**
     * @notice Check if signer has confirmed a transaction
     */
    function hasConfirmed(uint256 txId, address signer) external view returns (bool) {
        return confirmations[txId][signer];
    }

    /**
     * @notice Get confirmations needed
     */
    function getConfirmationsNeeded(uint256 txId) external view returns (uint256) {
        Transaction storage txn = transactions[txId];
        if (txn.confirmations >= threshold) return 0;
        return threshold - txn.confirmations;
    }

    /**
     * @notice Get geographic distribution of signers
     */
    function getGeographicDistribution() external view returns (string[] memory countries) {
        countries = new string[](signers.length);
        for (uint256 i = 0; i < signers.length; i++) {
            countries[i] = signerInfo[signers[i]].countryCode;
        }
        return countries;
    }

    /**
     * @notice Get emergency recovery status
     */
    function getEmergencyRecoveryStatus() external view returns (
        bool isInitiated,
        uint256 initiatedAt,
        uint256 canExecuteAfter,
        uint256 pendingSignerCount
    ) {
        return (
            emergencyRecoveryInitiated != 0,
            emergencyRecoveryInitiated,
            emergencyRecoveryInitiated != 0 ? emergencyRecoveryInitiated + EMERGENCY_RECOVERY_DELAY : 0,
            pendingEmergencySigners.length
        );
    }

    // ============ Receive ============

    receive() external payable {}
}
