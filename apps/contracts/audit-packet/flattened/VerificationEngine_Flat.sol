// Sources flattened with hardhat v2.28.4 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (utils/Address.sol)

pragma solidity ^0.8.1;

/**
 * @dev Collection of functions related to the address type
 */
library AddressUpgradeable {
    /**
     * @dev Returns true if `account` is a contract.
     *
     * [IMPORTANT]
     * ====
     * It is unsafe to assume that an address for which this function returns
     * false is an externally-owned account (EOA) and not a contract.
     *
     * Among others, `isContract` will return false for the following
     * types of addresses:
     *
     *  - an externally-owned account
     *  - a contract in construction
     *  - an address where a contract will be created
     *  - an address where a contract lived, but was destroyed
     *
     * Furthermore, `isContract` will also return true if the target contract within
     * the same transaction is already scheduled for destruction by `SELFDESTRUCT`,
     * which only has an effect at the end of a transaction.
     * ====
     *
     * [IMPORTANT]
     * ====
     * You shouldn't rely on `isContract` to protect against flash loan attacks!
     *
     * Preventing calls from contracts is highly discouraged. It breaks composability, breaks support for smart wallets
     * like Gnosis Safe, and does not provide security since it can be circumvented by calling from a contract
     * constructor.
     * ====
     */
    function isContract(address account) internal view returns (bool) {
        // This method relies on extcodesize/address.code.length, which returns 0
        // for contracts in construction, since the code is only stored at the end
        // of the constructor execution.

        return account.code.length > 0;
    }

    /**
     * @dev Replacement for Solidity's `transfer`: sends `amount` wei to
     * `recipient`, forwarding all available gas and reverting on errors.
     *
     * https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
     * of certain opcodes, possibly making contracts go over the 2300 gas limit
     * imposed by `transfer`, making them unable to receive funds via
     * `transfer`. {sendValue} removes this limitation.
     *
     * https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/[Learn more].
     *
     * IMPORTANT: because control is transferred to `recipient`, care must be
     * taken to not create reentrancy vulnerabilities. Consider using
     * {ReentrancyGuard} or the
     * https://solidity.readthedocs.io/en/v0.8.0/security-considerations.html#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    /**
     * @dev Performs a Solidity function call using a low level `call`. A
     * plain `call` is an unsafe replacement for a function call: use this
     * function instead.
     *
     * If `target` reverts with a revert reason, it is bubbled up by this
     * function (like regular Solidity function calls).
     *
     * Returns the raw returned data. To convert to the expected return value,
     * use https://solidity.readthedocs.io/en/latest/units-and-global-variables.html?highlight=abi.decode#abi-encoding-and-decoding-functions[`abi.decode`].
     *
     * Requirements:
     *
     * - `target` must be a contract.
     * - calling `target` with `data` must not revert.
     *
     * _Available since v3.1._
     */
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, "Address: low-level call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`], but with
     * `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but also transferring `value` wei to `target`.
     *
     * Requirements:
     *
     * - the calling contract must have an ETH balance of at least `value`.
     * - the called Solidity function must be `payable`.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    /**
     * @dev Same as {xref-Address-functionCallWithValue-address-bytes-uint256-}[`functionCallWithValue`], but
     * with `errorMessage` as a fallback revert reason when `target` reverts.
     *
     * _Available since v3.1._
     */
    function functionCallWithValue(
        address target,
        bytes memory data,
        uint256 value,
        string memory errorMessage
    ) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a static call.
     *
     * _Available since v3.3._
     */
    function functionStaticCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionDelegateCall(target, data, "Address: low-level delegate call failed");
    }

    /**
     * @dev Same as {xref-Address-functionCall-address-bytes-string-}[`functionCall`],
     * but performing a delegate call.
     *
     * _Available since v3.4._
     */
    function functionDelegateCall(
        address target,
        bytes memory data,
        string memory errorMessage
    ) internal returns (bytes memory) {
        (bool success, bytes memory returndata) = target.delegatecall(data);
        return verifyCallResultFromTarget(target, success, returndata, errorMessage);
    }

    /**
     * @dev Tool to verify that a low level call to smart-contract was successful, and revert (either by bubbling
     * the revert reason or using the provided one) in case of unsuccessful call or if target was not a contract.
     *
     * _Available since v4.8._
     */
    function verifyCallResultFromTarget(
        address target,
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal view returns (bytes memory) {
        if (success) {
            if (returndata.length == 0) {
                // only check isContract if the call was successful and the return data is empty
                // otherwise we already know that it was a contract
                require(isContract(target), "Address: call to non-contract");
            }
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    /**
     * @dev Tool to verify that a low level call was successful, and revert if it wasn't, either by bubbling the
     * revert reason or using the provided one.
     *
     * _Available since v4.3._
     */
    function verifyCallResult(
        bool success,
        bytes memory returndata,
        string memory errorMessage
    ) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            _revert(returndata, errorMessage);
        }
    }

    function _revert(bytes memory returndata, string memory errorMessage) private pure {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
            // The easiest way to bubble the revert reason is using memory via assembly
            /// @solidity memory-safe-assembly
            assembly {
                let returndata_size := mload(returndata)
                revert(add(32, returndata), returndata_size)
            }
        } else {
            revert(errorMessage);
        }
    }
}


// File @openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (proxy/utils/Initializable.sol)

pragma solidity ^0.8.2;

/**
 * @dev This is a base contract to aid in writing upgradeable contracts, or any kind of contract that will be deployed
 * behind a proxy. Since proxied contracts do not make use of a constructor, it's common to move constructor logic to an
 * external initializer function, usually called `initialize`. It then becomes necessary to protect this initializer
 * function so it can only be called once. The {initializer} modifier provided by this contract will have this effect.
 *
 * The initialization functions use a version number. Once a version number is used, it is consumed and cannot be
 * reused. This mechanism prevents re-execution of each "step" but allows the creation of new initialization steps in
 * case an upgrade adds a module that needs to be initialized.
 *
 * For example:
 *
 * [.hljs-theme-light.nopadding]
 * ```solidity
 * contract MyToken is ERC20Upgradeable {
 *     function initialize() initializer public {
 *         __ERC20_init("MyToken", "MTK");
 *     }
 * }
 *
 * contract MyTokenV2 is MyToken, ERC20PermitUpgradeable {
 *     function initializeV2() reinitializer(2) public {
 *         __ERC20Permit_init("MyToken");
 *     }
 * }
 * ```
 *
 * TIP: To avoid leaving the proxy in an uninitialized state, the initializer function should be called as early as
 * possible by providing the encoded function call as the `_data` argument to {ERC1967Proxy-constructor}.
 *
 * CAUTION: When used with inheritance, manual care must be taken to not invoke a parent initializer twice, or to ensure
 * that all initializers are idempotent. This is not verified automatically as constructors are by Solidity.
 *
 * [CAUTION]
 * ====
 * Avoid leaving a contract uninitialized.
 *
 * An uninitialized contract can be taken over by an attacker. This applies to both a proxy and its implementation
 * contract, which may impact the proxy. To prevent the implementation contract from being used, you should invoke
 * the {_disableInitializers} function in the constructor to automatically lock it when it is deployed:
 *
 * [.hljs-theme-light.nopadding]
 * ```
 * /// @custom:oz-upgrades-unsafe-allow constructor
 * constructor() {
 *     _disableInitializers();
 * }
 * ```
 * ====
 */
abstract contract Initializable {
    /**
     * @dev Indicates that the contract has been initialized.
     * @custom:oz-retyped-from bool
     */
    uint8 private _initialized;

    /**
     * @dev Indicates that the contract is in the process of being initialized.
     */
    bool private _initializing;

    /**
     * @dev Triggered when the contract has been initialized or reinitialized.
     */
    event Initialized(uint8 version);

    /**
     * @dev A modifier that defines a protected initializer function that can be invoked at most once. In its scope,
     * `onlyInitializing` functions can be used to initialize parent contracts.
     *
     * Similar to `reinitializer(1)`, except that functions marked with `initializer` can be nested in the context of a
     * constructor.
     *
     * Emits an {Initialized} event.
     */
    modifier initializer() {
        bool isTopLevelCall = !_initializing;
        require(
            (isTopLevelCall && _initialized < 1) || (!AddressUpgradeable.isContract(address(this)) && _initialized == 1),
            "Initializable: contract is already initialized"
        );
        _initialized = 1;
        if (isTopLevelCall) {
            _initializing = true;
        }
        _;
        if (isTopLevelCall) {
            _initializing = false;
            emit Initialized(1);
        }
    }

    /**
     * @dev A modifier that defines a protected reinitializer function that can be invoked at most once, and only if the
     * contract hasn't been initialized to a greater version before. In its scope, `onlyInitializing` functions can be
     * used to initialize parent contracts.
     *
     * A reinitializer may be used after the original initialization step. This is essential to configure modules that
     * are added through upgrades and that require initialization.
     *
     * When `version` is 1, this modifier is similar to `initializer`, except that functions marked with `reinitializer`
     * cannot be nested. If one is invoked in the context of another, execution will revert.
     *
     * Note that versions can jump in increments greater than 1; this implies that if multiple reinitializers coexist in
     * a contract, executing them in the right order is up to the developer or operator.
     *
     * WARNING: setting the version to 255 will prevent any future reinitialization.
     *
     * Emits an {Initialized} event.
     */
    modifier reinitializer(uint8 version) {
        require(!_initializing && _initialized < version, "Initializable: contract is already initialized");
        _initialized = version;
        _initializing = true;
        _;
        _initializing = false;
        emit Initialized(version);
    }

    /**
     * @dev Modifier to protect an initialization function so that it can only be invoked by functions with the
     * {initializer} and {reinitializer} modifiers, directly or indirectly.
     */
    modifier onlyInitializing() {
        require(_initializing, "Initializable: contract is not initializing");
        _;
    }

    /**
     * @dev Locks the contract, preventing any future reinitialization. This cannot be part of an initializer call.
     * Calling this in the constructor of a contract will prevent that contract from being initialized or reinitialized
     * to any version. It is recommended to use this to lock implementation contracts that are designed to be called
     * through proxies.
     *
     * Emits an {Initialized} event the first time it is successfully executed.
     */
    function _disableInitializers() internal virtual {
        require(!_initializing, "Initializable: contract is initializing");
        if (_initialized != type(uint8).max) {
            _initialized = type(uint8).max;
            emit Initialized(type(uint8).max);
        }
    }

    /**
     * @dev Returns the highest version that has been initialized. See {reinitializer}.
     */
    function _getInitializedVersion() internal view returns (uint8) {
        return _initialized;
    }

    /**
     * @dev Returns `true` if the contract is currently initializing. See {onlyInitializing}.
     */
    function _isInitializing() internal view returns (bool) {
        return _initializing;
    }
}


// File @openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.4) (utils/Context.sol)

pragma solidity ^0.8.0;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract ContextUpgradeable is Initializable {
    function __Context_init() internal onlyInitializing {
    }

    function __Context_init_unchained() internal onlyInitializing {
    }
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}


// File @openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

pragma solidity ^0.8.0;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract OwnableUpgradeable is Initializable, ContextUpgradeable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    function __Ownable_init() internal onlyInitializing {
        __Ownable_init_unchained();
    }

    function __Ownable_init_unchained() internal onlyInitializing {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}


// File @openzeppelin/contracts-upgradeable/interfaces/draft-IERC1822Upgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.5.0) (interfaces/draft-IERC1822.sol)

pragma solidity ^0.8.0;

/**
 * @dev ERC1822: Universal Upgradeable Proxy Standard (UUPS) documents a method for upgradeability through a simplified
 * proxy whose upgrades are fully controlled by the current implementation.
 */
interface IERC1822ProxiableUpgradeable {
    /**
     * @dev Returns the storage slot that the proxiable contract assumes is being used to store the implementation
     * address.
     *
     * IMPORTANT: A proxy pointing at a proxiable contract should not be considered proxiable itself, because this risks
     * bricking a proxy that upgrades to it, by delegating to itself until out of gas. Thus it is critical that this
     * function revert if invoked through a proxy.
     */
    function proxiableUUID() external view returns (bytes32);
}


// File @openzeppelin/contracts-upgradeable/interfaces/IERC1967Upgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (interfaces/IERC1967.sol)

pragma solidity ^0.8.0;

/**
 * @dev ERC-1967: Proxy Storage Slots. This interface contains the events defined in the ERC.
 *
 * _Available since v4.8.3._
 */
interface IERC1967Upgradeable {
    /**
     * @dev Emitted when the implementation is upgraded.
     */
    event Upgraded(address indexed implementation);

    /**
     * @dev Emitted when the admin account has changed.
     */
    event AdminChanged(address previousAdmin, address newAdmin);

    /**
     * @dev Emitted when the beacon is changed.
     */
    event BeaconUpgraded(address indexed beacon);
}


// File @openzeppelin/contracts-upgradeable/proxy/beacon/IBeaconUpgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (proxy/beacon/IBeacon.sol)

pragma solidity ^0.8.0;

/**
 * @dev This is the interface that {BeaconProxy} expects of its beacon.
 */
interface IBeaconUpgradeable {
    /**
     * @dev Must return an address that can be used as a delegate call target.
     *
     * {BeaconProxy} will check that this address is a contract.
     */
    function implementation() external view returns (address);
}


// File @openzeppelin/contracts-upgradeable/utils/StorageSlotUpgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

pragma solidity ^0.8.0;

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(Address.isContract(newImplementation), "ERC1967: new implementation is not a contract");
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * _Available since v4.1 for `address`, `bool`, `bytes32`, `uint256`._
 * _Available since v4.9 for `string`, `bytes`._
 */
library StorageSlotUpgradeable {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        /// @solidity memory-safe-assembly
        assembly {
            r.slot := store.slot
        }
    }
}


// File @openzeppelin/contracts-upgradeable/proxy/ERC1967/ERC1967UpgradeUpgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (proxy/ERC1967/ERC1967Upgrade.sol)

pragma solidity ^0.8.2;






/**
 * @dev This abstract contract provides getters and event emitting update functions for
 * https://eips.ethereum.org/EIPS/eip-1967[EIP1967] slots.
 *
 * _Available since v4.1._
 */
abstract contract ERC1967UpgradeUpgradeable is Initializable, IERC1967Upgradeable {
    // This is the keccak-256 hash of "eip1967.proxy.rollback" subtracted by 1
    bytes32 private constant _ROLLBACK_SLOT = 0x4910fdfa16fed3260ed0e7147f7cc6da11a60208b5b9406d12a635614ffd9143;

    /**
     * @dev Storage slot with the address of the current implementation.
     * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    function __ERC1967Upgrade_init() internal onlyInitializing {
    }

    function __ERC1967Upgrade_init_unchained() internal onlyInitializing {
    }
    /**
     * @dev Returns the current implementation address.
     */
    function _getImplementation() internal view returns (address) {
        return StorageSlotUpgradeable.getAddressSlot(_IMPLEMENTATION_SLOT).value;
    }

    /**
     * @dev Stores a new address in the EIP1967 implementation slot.
     */
    function _setImplementation(address newImplementation) private {
        require(AddressUpgradeable.isContract(newImplementation), "ERC1967: new implementation is not a contract");
        StorageSlotUpgradeable.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
    }

    /**
     * @dev Perform implementation upgrade
     *
     * Emits an {Upgraded} event.
     */
    function _upgradeTo(address newImplementation) internal {
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    /**
     * @dev Perform implementation upgrade with additional setup call.
     *
     * Emits an {Upgraded} event.
     */
    function _upgradeToAndCall(address newImplementation, bytes memory data, bool forceCall) internal {
        _upgradeTo(newImplementation);
        if (data.length > 0 || forceCall) {
            AddressUpgradeable.functionDelegateCall(newImplementation, data);
        }
    }

    /**
     * @dev Perform implementation upgrade with security checks for UUPS proxies, and additional setup call.
     *
     * Emits an {Upgraded} event.
     */
    function _upgradeToAndCallUUPS(address newImplementation, bytes memory data, bool forceCall) internal {
        // Upgrades from old implementations will perform a rollback test. This test requires the new
        // implementation to upgrade back to the old, non-ERC1822 compliant, implementation. Removing
        // this special case will break upgrade paths from old UUPS implementation to new ones.
        if (StorageSlotUpgradeable.getBooleanSlot(_ROLLBACK_SLOT).value) {
            _setImplementation(newImplementation);
        } else {
            try IERC1822ProxiableUpgradeable(newImplementation).proxiableUUID() returns (bytes32 slot) {
                require(slot == _IMPLEMENTATION_SLOT, "ERC1967Upgrade: unsupported proxiableUUID");
            } catch {
                revert("ERC1967Upgrade: new implementation is not UUPS");
            }
            _upgradeToAndCall(newImplementation, data, forceCall);
        }
    }

    /**
     * @dev Storage slot with the admin of the contract.
     * This is the keccak-256 hash of "eip1967.proxy.admin" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 internal constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    /**
     * @dev Returns the current admin.
     */
    function _getAdmin() internal view returns (address) {
        return StorageSlotUpgradeable.getAddressSlot(_ADMIN_SLOT).value;
    }

    /**
     * @dev Stores a new address in the EIP1967 admin slot.
     */
    function _setAdmin(address newAdmin) private {
        require(newAdmin != address(0), "ERC1967: new admin is the zero address");
        StorageSlotUpgradeable.getAddressSlot(_ADMIN_SLOT).value = newAdmin;
    }

    /**
     * @dev Changes the admin of the proxy.
     *
     * Emits an {AdminChanged} event.
     */
    function _changeAdmin(address newAdmin) internal {
        emit AdminChanged(_getAdmin(), newAdmin);
        _setAdmin(newAdmin);
    }

    /**
     * @dev The storage slot of the UpgradeableBeacon contract which defines the implementation for this proxy.
     * This is bytes32(uint256(keccak256('eip1967.proxy.beacon')) - 1)) and is validated in the constructor.
     */
    bytes32 internal constant _BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    /**
     * @dev Returns the current beacon.
     */
    function _getBeacon() internal view returns (address) {
        return StorageSlotUpgradeable.getAddressSlot(_BEACON_SLOT).value;
    }

    /**
     * @dev Stores a new beacon in the EIP1967 beacon slot.
     */
    function _setBeacon(address newBeacon) private {
        require(AddressUpgradeable.isContract(newBeacon), "ERC1967: new beacon is not a contract");
        require(
            AddressUpgradeable.isContract(IBeaconUpgradeable(newBeacon).implementation()),
            "ERC1967: beacon implementation is not a contract"
        );
        StorageSlotUpgradeable.getAddressSlot(_BEACON_SLOT).value = newBeacon;
    }

    /**
     * @dev Perform beacon upgrade with additional setup call. Note: This upgrades the address of the beacon, it does
     * not upgrade the implementation contained in the beacon (see {UpgradeableBeacon-_setImplementation} for that).
     *
     * Emits a {BeaconUpgraded} event.
     */
    function _upgradeBeaconToAndCall(address newBeacon, bytes memory data, bool forceCall) internal {
        _setBeacon(newBeacon);
        emit BeaconUpgraded(newBeacon);
        if (data.length > 0 || forceCall) {
            AddressUpgradeable.functionDelegateCall(IBeaconUpgradeable(newBeacon).implementation(), data);
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}


// File @openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (proxy/utils/UUPSUpgradeable.sol)

pragma solidity ^0.8.0;



/**
 * @dev An upgradeability mechanism designed for UUPS proxies. The functions included here can perform an upgrade of an
 * {ERC1967Proxy}, when this contract is set as the implementation behind such a proxy.
 *
 * A security mechanism ensures that an upgrade does not turn off upgradeability accidentally, although this risk is
 * reinstated if the upgrade retains upgradeability but removes the security mechanism, e.g. by replacing
 * `UUPSUpgradeable` with a custom implementation of upgrades.
 *
 * The {_authorizeUpgrade} function must be overridden to include access restriction to the upgrade mechanism.
 *
 * _Available since v4.1._
 */
abstract contract UUPSUpgradeable is Initializable, IERC1822ProxiableUpgradeable, ERC1967UpgradeUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable state-variable-assignment
    address private immutable __self = address(this);

    /**
     * @dev Check that the execution is being performed through a delegatecall call and that the execution context is
     * a proxy contract with an implementation (as defined in ERC1967) pointing to self. This should only be the case
     * for UUPS and transparent proxies that are using the current contract as their implementation. Execution of a
     * function through ERC1167 minimal proxies (clones) would not normally pass this test, but is not guaranteed to
     * fail.
     */
    modifier onlyProxy() {
        require(address(this) != __self, "Function must be called through delegatecall");
        require(_getImplementation() == __self, "Function must be called through active proxy");
        _;
    }

    /**
     * @dev Check that the execution is not being performed through a delegate call. This allows a function to be
     * callable on the implementing contract but not through proxies.
     */
    modifier notDelegated() {
        require(address(this) == __self, "UUPSUpgradeable: must not be called through delegatecall");
        _;
    }

    function __UUPSUpgradeable_init() internal onlyInitializing {
    }

    function __UUPSUpgradeable_init_unchained() internal onlyInitializing {
    }
    /**
     * @dev Implementation of the ERC1822 {proxiableUUID} function. This returns the storage slot used by the
     * implementation. It is used to validate the implementation's compatibility when performing an upgrade.
     *
     * IMPORTANT: A proxy pointing at a proxiable contract should not be considered proxiable itself, because this risks
     * bricking a proxy that upgrades to it, by delegating to itself until out of gas. Thus it is critical that this
     * function revert if invoked through a proxy. This is guaranteed by the `notDelegated` modifier.
     */
    function proxiableUUID() external view virtual override notDelegated returns (bytes32) {
        return _IMPLEMENTATION_SLOT;
    }

    /**
     * @dev Upgrade the implementation of the proxy to `newImplementation`.
     *
     * Calls {_authorizeUpgrade}.
     *
     * Emits an {Upgraded} event.
     *
     * @custom:oz-upgrades-unsafe-allow-reachable delegatecall
     */
    function upgradeTo(address newImplementation) public virtual onlyProxy {
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, new bytes(0), false);
    }

    /**
     * @dev Upgrade the implementation of the proxy to `newImplementation`, and subsequently execute the function call
     * encoded in `data`.
     *
     * Calls {_authorizeUpgrade}.
     *
     * Emits an {Upgraded} event.
     *
     * @custom:oz-upgrades-unsafe-allow-reachable delegatecall
     */
    function upgradeToAndCall(address newImplementation, bytes memory data) public payable virtual onlyProxy {
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCallUUPS(newImplementation, data, true);
    }

    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     *
     * Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.
     *
     * ```solidity
     * function _authorizeUpgrade(address) internal override onlyOwner {}
     * ```
     */
    function _authorizeUpgrade(address newImplementation) internal virtual;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}


// File @openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (security/ReentrancyGuard.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuardUpgradeable is Initializable {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    function __ReentrancyGuard_init() internal onlyInitializing {
        __ReentrancyGuard_init_unchained();
    }

    function __ReentrancyGuard_init_unchained() internal onlyInitializing {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}


// File contracts/interfaces/IVerificationEngine.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVerificationEngine
 * @notice Interface for the Proof-of-Physics verification engine
 * @dev Implements three-phase verification: Source, Logic, Mint
 */
interface IVerificationEngine {
    /**
     * @notice Verify carbon capture data before minting
     * @param dacUnitId The DAC facility identifier
     * @param sourceDataHash Hash of the off-chain sensor data
     * @param co2AmountKg Amount of CO2 captured in kilograms
     * @param energyConsumedKwh Energy consumed in kilowatt-hours
     * @param purityPercentage CO2 purity percentage (0-100)
     * @return sourceVerified Whether the source check passed
     * @return logicVerified Whether the logic check passed
     * @return mintVerified Whether the mint check passed
     * @return efficiencyFactor Calculated efficiency factor (scaled by 1e4)
     */
    function verify(
        bytes32 dacUnitId,
        bytes32 sourceDataHash,
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage
    ) external returns (
        bool sourceVerified,
        bool logicVerified,
        bool mintVerified,
        uint256 efficiencyFactor
    );

    /**
     * @notice Check if a DAC unit is whitelisted
     * @param dacUnitId The DAC facility identifier
     * @return Whether the DAC unit is whitelisted
     */
    function isWhitelisted(bytes32 dacUnitId) external view returns (bool);

    /**
     * @notice Get the operator address for a DAC unit
     * @param dacUnitId The DAC facility identifier
     * @return The operator's address
     */
    function getOperator(bytes32 dacUnitId) external view returns (address);

    /**
     * @notice Check if a data hash has already been processed
     * @param sourceDataHash The hash to check
     * @return Whether the hash has been used
     */
    function isHashProcessed(bytes32 sourceDataHash) external view returns (bool);
}


// File contracts/libraries/EfficiencyCalculator.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EfficiencyCalculator
 * @notice Library for calculating carbon credit efficiency factors
 * @dev Implements the Proof-of-Physics efficiency calculation
 *
 * The efficiency factor rewards more efficient carbon capture while
 * penalizing wasteful operations. The calculation is based on:
 * 1. Energy consumption per tonne of CO2 captured
 * 2. CO2 purity percentage
 *
 * Efficiency Factor Range: 5000 (50%) to 10500 (105%)
 * Optimal efficiency (350 kWh/tonne) = 10000 (100%)
 */
library EfficiencyCalculator {
    /**
     * @notice Calculate efficiency factor based on energy consumption and purity
     * @param kwhPerTonne Actual kWh consumed per tonne of CO2
     * @param optimal Optimal kWh per tonne (best case scenario)
     * @param minAcceptable Minimum acceptable (below = fraud indicator)
     * @param maxAcceptable Maximum acceptable (above = too inefficient)
     * @param scale Scaling factor (e.g., 10000 = 100%)
     * @return factor Efficiency factor (scaled)
     *
     * @dev The calculation follows this logic:
     * - If at or better than optimal: Linear bonus from 100% to 105%
     * - If worse than optimal: Linear penalty from 100% to 50%
     * - Outside bounds returns 0 (invalid)
     */
    function calculate(
        uint256 kwhPerTonne,
        uint256 optimal,
        uint256 minAcceptable,
        uint256 maxAcceptable,
        uint256 scale
    ) internal pure returns (uint256 factor) {
        // Outside acceptable range
        if (kwhPerTonne < minAcceptable || kwhPerTonne > maxAcceptable) {
            return 0;
        }

        // Better than or equal to optimal - apply bonus
        if (kwhPerTonne <= optimal) {
            // Calculate bonus: max 5% for reaching minimum
            // Formula: scale + (scale/20 * (optimal - actual) / (optimal - min))
            uint256 improvement = optimal - kwhPerTonne;
            uint256 range = optimal - minAcceptable;

            if (range > 0) {
                uint256 bonus = (scale * improvement) / (range * 20);
                factor = scale + bonus;
            } else {
                factor = scale;
            }
        } else {
            // Worse than optimal - apply penalty
            // Calculate penalty: max 50% for reaching maximum
            // Formula: scale - (scale/2 * (actual - optimal) / (max - optimal))
            uint256 degradation = kwhPerTonne - optimal;
            uint256 range = maxAcceptable - optimal;

            if (range > 0) {
                uint256 penalty = (scale * degradation) / (range * 2);
                factor = scale > penalty ? scale - penalty : scale / 2;
            } else {
                factor = scale;
            }
        }

        // Ensure bounds: minimum 50%, maximum 105%
        uint256 minFactor = scale / 2;
        uint256 maxFactor = scale + (scale / 20);

        if (factor < minFactor) factor = minFactor;
        if (factor > maxFactor) factor = maxFactor;

        return factor;
    }

    /**
     * @notice Apply purity adjustment to efficiency factor
     * @param baseFactor The base efficiency factor from energy calculation
     * @param purityPercentage The CO2 purity percentage (0-100)
     * @param scale Scaling factor (10000 = 100%)
     * @return adjustedFactor The purity-adjusted efficiency factor
     *
     * @dev Purity adjustment formula:
     * - 100% purity = 105% factor
     * - 95% purity = 100% factor (neutral)
     * - 90% purity = 95% factor
     */
    function applyPurityAdjustment(
        uint256 baseFactor,
        uint8 purityPercentage,
        uint256 scale
    ) internal pure returns (uint256 adjustedFactor) {
        // Calculate purity factor: (scale + (purity - 95) * 100)
        // At 100% purity: scale + 500 = 10500 (105%)
        // At 95% purity: scale + 0 = 10000 (100%)
        // At 90% purity: scale - 500 = 9500 (95%)

        int256 purityDelta = int256(uint256(purityPercentage)) - 95;
        int256 purityFactor = int256(scale) + (purityDelta * 100);

        // Ensure purity factor is positive
        if (purityFactor <= 0) {
            purityFactor = int256(scale / 2);
        }

        // Apply purity factor to base factor
        adjustedFactor = (baseFactor * uint256(purityFactor)) / scale;

        // Ensure minimum floor
        uint256 minFactor = scale / 2;
        if (adjustedFactor < minFactor) {
            adjustedFactor = minFactor;
        }

        return adjustedFactor;
    }

    /**
     * @notice Calculate credits to mint based on CO2 amount and efficiency
     * @param co2AmountKg Raw CO2 captured in kilograms
     * @param efficiencyFactor The efficiency factor (scaled by 1e4)
     * @param scale The scale factor (10000 = 100%)
     * @return credits Number of credits to mint
     */
    function calculateCredits(
        uint256 co2AmountKg,
        uint256 efficiencyFactor,
        uint256 scale
    ) internal pure returns (uint256 credits) {
        // 1 credit = 1 kg CO2 * efficiency factor
        credits = (co2AmountKg * efficiencyFactor) / scale;
        return credits;
    }
}


// File contracts/core/VerificationEngine.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.20;






/**
 * @title VerificationEngine
 * @author TerraQura
 * @notice Implements "Proof-of-Physics" verification for carbon credits
 * @dev Three-phase verification: Source, Logic, Mint
 *
 * This contract validates that carbon capture data is:
 * 1. From a legitimate, whitelisted DAC facility (Source Check)
 * 2. Physically plausible based on energy/CO2 ratios (Logic Check)
 * 3. Not a duplicate submission (Mint Check)
 *
 * The verification engine is the core anti-fraud mechanism that ensures
 * only legitimate carbon capture events can be minted as credits.
 */
contract VerificationEngine is
    Initializable,
    IVerificationEngine,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using EfficiencyCalculator for uint256;

    // ============ Constants ============

    /**
     * @notice Expected energy consumption per tonne CO2 captured (kWh)
     * @dev Based on DAC industry benchmarks: 200-600 kWh per tonne
     * Values below MIN are fraud indicators (impossibly efficient)
     * Values above MAX are rejected as too inefficient
     */
    uint256 public constant MIN_KWH_PER_TONNE = 200;
    uint256 public constant MAX_KWH_PER_TONNE = 600;
    uint256 public constant OPTIMAL_KWH_PER_TONNE = 350;

    /**
     * @notice Minimum acceptable CO2 purity percentage
     */
    uint8 public constant MIN_PURITY_PERCENTAGE = 90;

    /**
     * @notice Scaling factor for efficiency calculations
     * @dev 10000 = 100%, allows for 2 decimal places of precision
     */
    uint256 public constant SCALE = 10000;

    // ============ State Variables ============

    /**
     * @notice Mapping of DAC unit IDs to whitelist status
     */
    mapping(bytes32 => bool) public whitelistedDacUnits;

    /**
     * @notice Mapping of DAC unit IDs to operator addresses
     */
    mapping(bytes32 => address) public dacUnitOperators;

    /**
     * @notice Mapping of processed data hashes (prevents double-minting)
     */
    mapping(bytes32 => bool) private _processedHashes;

    /**
     * @notice Address of the CarbonCredit contract (only caller allowed to verify)
     */
    address public carbonCreditContract;

    // ============ Events ============

    /**
     * @notice Emitted when a DAC unit is whitelisted
     */
    event DacUnitWhitelisted(
        bytes32 indexed dacUnitId,
        address indexed operator,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a DAC unit is removed from whitelist
     */
    event DacUnitRemoved(
        bytes32 indexed dacUnitId,
        uint256 timestamp
    );

    /**
     * @notice Emitted for each verification phase
     */
    event VerificationPhaseCompleted(
        bytes32 indexed dacUnitId,
        bytes32 indexed sourceDataHash,
        string phase,
        bool passed,
        string reason
    );

    /**
     * @notice Emitted when the CarbonCredit contract address is updated
     */
    event CarbonCreditContractUpdated(
        address indexed oldAddress,
        address indexed newAddress
    );

    // ============ Errors ============

    error UnauthorizedCaller();
    error DacUnitAlreadyWhitelisted();
    error DacUnitNotWhitelisted();
    error InvalidOperatorAddress();
    error InvalidCarbonCreditContract();

    // ============ Modifiers ============

    /**
     * @notice Restricts function to CarbonCredit contract only
     */
    modifier onlyCarbonCredit() {
        if (msg.sender != carbonCreditContract) {
            revert UnauthorizedCaller();
        }
        _;
    }

    // ============ Constructor ============

    /**
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the verification engine
     * @param _accessControl Address of the access control contract (unused, for interface compatibility)
     * @param _carbonCreditContract Address of the CarbonCredit contract
     */
    function initialize(address _accessControl, address _carbonCreditContract) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        if (_carbonCreditContract != address(0)) {
            carbonCreditContract = _carbonCreditContract;
        }
        // _accessControl is reserved for future use
    }

    // ============ External Functions ============

    /**
     * @inheritdoc IVerificationEngine
     * @dev Only callable by the CarbonCredit contract
     */
    function verify(
        bytes32 dacUnitId,
        bytes32 sourceDataHash,
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage
    )
        external
        override
        onlyCarbonCredit
        nonReentrant
        returns (
            bool sourceVerified,
            bool logicVerified,
            bool mintVerified,
            uint256 efficiencyFactor
        )
    {
        // Phase 1: Source Check
        sourceVerified = _verifySource(dacUnitId, sourceDataHash);
        if (!sourceVerified) {
            return (false, false, false, 0);
        }

        // Phase 2: Logic Check (Proof-of-Physics)
        (logicVerified, efficiencyFactor) = _verifyLogic(
            dacUnitId,
            sourceDataHash,
            co2AmountKg,
            energyConsumedKwh,
            purityPercentage
        );
        if (!logicVerified) {
            return (true, false, false, 0);
        }

        // Phase 3: Mint Check
        mintVerified = _verifyMint(dacUnitId, sourceDataHash);
        if (!mintVerified) {
            return (true, true, false, efficiencyFactor);
        }

        // Mark hash as processed
        _processedHashes[sourceDataHash] = true;

        return (true, true, true, efficiencyFactor);
    }

    /**
     * @inheritdoc IVerificationEngine
     */
    function isWhitelisted(bytes32 dacUnitId) external view override returns (bool) {
        return whitelistedDacUnits[dacUnitId];
    }

    /**
     * @inheritdoc IVerificationEngine
     */
    function getOperator(bytes32 dacUnitId) external view override returns (address) {
        return dacUnitOperators[dacUnitId];
    }

    /**
     * @inheritdoc IVerificationEngine
     */
    function isHashProcessed(bytes32 sourceDataHash) external view override returns (bool) {
        return _processedHashes[sourceDataHash];
    }

    // ============ Admin Functions ============

    /**
     * @notice Whitelist a DAC unit
     * @param dacUnitId The unique identifier for the DAC facility
     * @param operator The address of the DAC facility operator
     */
    function whitelistDacUnit(
        bytes32 dacUnitId,
        address operator
    ) external onlyOwner {
        if (whitelistedDacUnits[dacUnitId]) {
            revert DacUnitAlreadyWhitelisted();
        }
        if (operator == address(0)) {
            revert InvalidOperatorAddress();
        }

        whitelistedDacUnits[dacUnitId] = true;
        dacUnitOperators[dacUnitId] = operator;

        emit DacUnitWhitelisted(dacUnitId, operator, block.timestamp);
    }

    /**
     * @notice Remove a DAC unit from the whitelist
     * @param dacUnitId The unique identifier for the DAC facility
     */
    function removeDacUnit(bytes32 dacUnitId) external onlyOwner {
        if (!whitelistedDacUnits[dacUnitId]) {
            revert DacUnitNotWhitelisted();
        }

        whitelistedDacUnits[dacUnitId] = false;
        delete dacUnitOperators[dacUnitId];

        emit DacUnitRemoved(dacUnitId, block.timestamp);
    }

    /**
     * @notice Update the operator address for a DAC unit
     * @param dacUnitId The unique identifier for the DAC facility
     * @param newOperator The new operator address
     */
    function updateOperator(
        bytes32 dacUnitId,
        address newOperator
    ) external onlyOwner {
        if (!whitelistedDacUnits[dacUnitId]) {
            revert DacUnitNotWhitelisted();
        }
        if (newOperator == address(0)) {
            revert InvalidOperatorAddress();
        }

        dacUnitOperators[dacUnitId] = newOperator;
    }

    /**
     * @notice Set the CarbonCredit contract address
     * @param _carbonCreditContract Address of the CarbonCredit contract
     */
    function setCarbonCreditContract(address _carbonCreditContract) external onlyOwner {
        if (_carbonCreditContract == address(0)) {
            revert InvalidCarbonCreditContract();
        }

        address oldAddress = carbonCreditContract;
        carbonCreditContract = _carbonCreditContract;

        emit CarbonCreditContractUpdated(oldAddress, _carbonCreditContract);
    }

    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @param newImplementation Address of new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Internal Functions ============

    /**
     * @notice Phase 1: Verify the data source is from a whitelisted DAC unit
     * @param dacUnitId The DAC facility identifier
     * @param sourceDataHash The hash of the source data (for event logging)
     * @return Whether the source verification passed
     */
    function _verifySource(
        bytes32 dacUnitId,
        bytes32 sourceDataHash
    ) internal returns (bool) {
        bool isWhitelistedUnit = whitelistedDacUnits[dacUnitId];

        emit VerificationPhaseCompleted(
            dacUnitId,
            sourceDataHash,
            "SOURCE",
            isWhitelistedUnit,
            isWhitelistedUnit ? "DAC unit is whitelisted" : "DAC unit not whitelisted"
        );

        return isWhitelistedUnit;
    }

    /**
     * @notice Phase 2: Verify the physics constraints (energy vs CO2 ratio)
     * @dev This is the core "Proof-of-Physics" check
     * @param dacUnitId The DAC facility identifier
     * @param sourceDataHash The hash of the source data
     * @param co2AmountKg CO2 captured in kilograms
     * @param energyConsumedKwh Energy consumed in kilowatt-hours
     * @param purityPercentage CO2 purity (0-100)
     * @return verified Whether the logic verification passed
     * @return efficiencyFactor The calculated efficiency factor
     */
    function _verifyLogic(
        bytes32 dacUnitId,
        bytes32 sourceDataHash,
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage
    ) internal returns (bool verified, uint256 efficiencyFactor) {
        // Check minimum purity threshold
        if (purityPercentage < MIN_PURITY_PERCENTAGE) {
            emit VerificationPhaseCompleted(
                dacUnitId,
                sourceDataHash,
                "LOGIC",
                false,
                "Purity below minimum threshold"
            );
            return (false, 0);
        }

        // Convert to per-tonne basis (1 tonne = 1000 kg)
        // Round up to prevent division by zero
        uint256 co2Tonnes = (co2AmountKg + 999) / 1000;
        if (co2Tonnes == 0) co2Tonnes = 1;

        uint256 kwhPerTonne = energyConsumedKwh / co2Tonnes;

        // Anomaly detection: Check if ratio is physically possible
        if (kwhPerTonne < MIN_KWH_PER_TONNE) {
            // Too efficient - likely fraudulent data
            emit VerificationPhaseCompleted(
                dacUnitId,
                sourceDataHash,
                "LOGIC",
                false,
                "Suspiciously efficient - potential fraud"
            );
            return (false, 0);
        }

        if (kwhPerTonne > MAX_KWH_PER_TONNE) {
            // Too inefficient - outside acceptable range
            emit VerificationPhaseCompleted(
                dacUnitId,
                sourceDataHash,
                "LOGIC",
                false,
                "Energy consumption too high"
            );
            return (false, 0);
        }

        // Calculate base efficiency factor
        efficiencyFactor = EfficiencyCalculator.calculate(
            kwhPerTonne,
            OPTIMAL_KWH_PER_TONNE,
            MIN_KWH_PER_TONNE,
            MAX_KWH_PER_TONNE,
            SCALE
        );

        // Apply purity adjustment
        efficiencyFactor = EfficiencyCalculator.applyPurityAdjustment(
            efficiencyFactor,
            purityPercentage,
            SCALE
        );

        emit VerificationPhaseCompleted(
            dacUnitId,
            sourceDataHash,
            "LOGIC",
            true,
            "Physics constraints verified"
        );

        return (true, efficiencyFactor);
    }

    /**
     * @notice Phase 3: Verify the data hash has not been used before
     * @param dacUnitId The DAC facility identifier
     * @param sourceDataHash The hash to check
     * @return Whether the mint verification passed
     */
    function _verifyMint(
        bytes32 dacUnitId,
        bytes32 sourceDataHash
    ) internal returns (bool) {
        bool isNewHash = !_processedHashes[sourceDataHash];

        emit VerificationPhaseCompleted(
            dacUnitId,
            sourceDataHash,
            "MINT",
            isNewHash,
            isNewHash ? "New data hash verified" : "Data hash already processed"
        );

        return isNewHash;
    }

    // ============ View Functions ============

    /**
     * @notice Get verification thresholds
     * @return minKwh Minimum kWh per tonne
     * @return maxKwh Maximum kWh per tonne
     * @return optimalKwh Optimal kWh per tonne
     * @return minPurity Minimum purity percentage
     */
    function getVerificationThresholds()
        external
        pure
        returns (
            uint256 minKwh,
            uint256 maxKwh,
            uint256 optimalKwh,
            uint8 minPurity
        )
    {
        return (
            MIN_KWH_PER_TONNE,
            MAX_KWH_PER_TONNE,
            OPTIMAL_KWH_PER_TONNE,
            MIN_PURITY_PERCENTAGE
        );
    }

    /**
     * @notice Preview efficiency factor calculation without state changes
     * @param co2AmountKg CO2 captured in kilograms
     * @param energyConsumedKwh Energy consumed in kilowatt-hours
     * @param purityPercentage CO2 purity (0-100)
     * @return isValid Whether the values would pass verification
     * @return efficiencyFactor The calculated efficiency factor
     */
    function previewEfficiencyFactor(
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage
    ) external pure returns (bool isValid, uint256 efficiencyFactor) {
        if (purityPercentage < MIN_PURITY_PERCENTAGE) {
            return (false, 0);
        }

        uint256 co2Tonnes = (co2AmountKg + 999) / 1000;
        if (co2Tonnes == 0) co2Tonnes = 1;

        uint256 kwhPerTonne = energyConsumedKwh / co2Tonnes;

        if (kwhPerTonne < MIN_KWH_PER_TONNE || kwhPerTonne > MAX_KWH_PER_TONNE) {
            return (false, 0);
        }

        efficiencyFactor = EfficiencyCalculator.calculate(
            kwhPerTonne,
            OPTIMAL_KWH_PER_TONNE,
            MIN_KWH_PER_TONNE,
            MAX_KWH_PER_TONNE,
            SCALE
        );

        efficiencyFactor = EfficiencyCalculator.applyPurityAdjustment(
            efficiencyFactor,
            purityPercentage,
            SCALE
        );

        return (true, efficiencyFactor);
    }
}
