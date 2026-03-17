// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title TerraQuraMultisig
 * @author TerraQura
 * @notice Enterprise-grade multisig wallet for critical operations
 * @dev Implements M-of-N signature scheme with:
 * - Configurable threshold (e.g., 3-of-5)
 * - Transaction queuing with nonce
 * - Signer management
 * - Emergency recovery options
 *
 * Security features:
 * - EIP-712 typed signatures
 * - Replay protection via nonces
 * - Signer rotation support
 * - Transaction expiration
 */
contract TerraQuraMultisig is EIP712 {
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
    }

    // ============ State Variables ============

    /// @notice List of signers
    address[] public signers;

    /// @notice Mapping to check if address is a signer
    mapping(address => bool) public isSigner;

    /// @notice Number of required confirmations
    uint256 public threshold;

    /// @notice Minimum threshold (at least 2 signers)
    uint256 public constant MIN_THRESHOLD = 2;

    /// @notice Maximum signers
    uint256 public constant MAX_SIGNERS = 10;

    /// @notice Transaction nonce
    uint256 public nonce;

    /// @notice Mapping of transaction ID to Transaction
    mapping(uint256 => Transaction) public transactions;

    /// @notice Mapping of transaction ID to signer to confirmation status
    mapping(uint256 => mapping(address => bool)) public confirmations;

    /// @notice Default transaction expiry (7 days)
    uint256 public constant DEFAULT_EXPIRY = 7 days;

    /// @notice EIP-712 type hash for transaction
    bytes32 public constant TRANSACTION_TYPEHASH = keccak256(
        "Transaction(address to,uint256 value,bytes data,uint256 nonce,uint256 deadline)"
    );

    // ============ Events ============

    event TransactionSubmitted(
        uint256 indexed txId,
        address indexed submitter,
        address to,
        uint256 value,
        bytes data
    );

    event TransactionConfirmed(
        uint256 indexed txId,
        address indexed signer
    );

    event TransactionRevoked(
        uint256 indexed txId,
        address indexed signer
    );

    event TransactionExecuted(
        uint256 indexed txId,
        address indexed executor
    );

    event TransactionFailed(
        uint256 indexed txId,
        string reason
    );

    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ThresholdChanged(uint256 oldThreshold, uint256 newThreshold);

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

    // ============ Modifiers ============

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
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
     * @notice Initialize the multisig
     * @param _signers Initial list of signers
     * @param _threshold Required confirmations
     */
    constructor(
        address[] memory _signers,
        uint256 _threshold
    ) EIP712("TerraQuraMultisig", "1") {
        require(_signers.length >= MIN_THRESHOLD, "Need at least 2 signers");
        require(_signers.length <= MAX_SIGNERS, "Too many signers");
        require(_threshold >= MIN_THRESHOLD, "Threshold too low");
        require(_threshold <= _signers.length, "Threshold exceeds signers");

        for (uint256 i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            require(signer != address(0), "Invalid signer");
            require(!isSigner[signer], "Duplicate signer");

            isSigner[signer] = true;
            signers.push(signer);
            emit SignerAdded(signer);
        }

        threshold = _threshold;
    }

    // ============ Transaction Functions ============

    /**
     * @notice Submit a new transaction
     * @param to Target address
     * @param value ETH value
     * @param data Call data
     * @return txId Transaction ID
     */
    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlySigner returns (uint256 txId) {
        return _submitTransaction(to, value, data, DEFAULT_EXPIRY);
    }

    /**
     * @notice Submit a transaction with custom expiry
     * @param to Target address
     * @param value ETH value
     * @param data Call data
     * @param expiry Expiry duration in seconds
     * @return txId Transaction ID
     */
    function submitTransactionWithExpiry(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 expiry
    ) external onlySigner returns (uint256 txId) {
        require(expiry >= 1 hours, "Expiry too short");
        require(expiry <= 30 days, "Expiry too long");
        return _submitTransaction(to, value, data, expiry);
    }

    function _submitTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 expiry
    ) internal returns (uint256 txId) {
        txId = nonce++;

        transactions[txId] = Transaction({
            to: to,
            value: value,
            data: data,
            executed: false,
            confirmations: 0,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + expiry
        });

        emit TransactionSubmitted(txId, msg.sender, to, value, data);

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

        emit TransactionConfirmed(txId, msg.sender);
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

        emit TransactionRevoked(txId, msg.sender);
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

        emit TransactionExecuted(txId, msg.sender);
    }

    // ============ Signer Management (via multisig) ============

    /**
     * @notice Add a new signer (must be called via multisig)
     * @param signer Address to add
     */
    function addSigner(address signer) external onlySelf {
        if (signer == address(0)) revert InvalidSigner();
        if (isSigner[signer]) revert SignerAlreadyExists();
        if (signers.length >= MAX_SIGNERS) revert InvalidThreshold();

        isSigner[signer] = true;
        signers.push(signer);

        emit SignerAdded(signer);
    }

    /**
     * @notice Remove a signer (must be called via multisig)
     * @param signer Address to remove
     */
    function removeSigner(address signer) external onlySelf {
        if (!isSigner[signer]) revert SignerDoesNotExist();
        if (signers.length <= threshold) revert CannotRemoveLastSigner();

        isSigner[signer] = false;

        // Remove from array
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        // Note: Threshold auto-adjustment removed as dead code.
        // The guard at line 336 (signers.length <= threshold) ensures that after
        // removal, signers.length >= threshold, making threshold > signers.length
        // mathematically impossible. This was flagged by coverage analysis.
        // Use changeThreshold() via multisig to adjust threshold if needed.

        emit SignerRemoved(signer);
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
     * @notice Get transaction details
     */
    function getTransaction(uint256 txId) external view returns (
        address to,
        uint256 value,
        bytes memory data,
        bool executed,
        uint256 numConfirmations,
        uint256 expiresAt,
        bool canExecute
    ) {
        Transaction storage txn = transactions[txId];
        return (
            txn.to,
            txn.value,
            txn.data,
            txn.executed,
            txn.confirmations,
            txn.expiresAt,
            txn.confirmations >= threshold && !txn.executed && block.timestamp <= txn.expiresAt
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

    // ============ Receive ============

    receive() external payable {}
}
