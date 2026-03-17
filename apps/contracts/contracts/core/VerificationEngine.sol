// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IVerificationEngine.sol";
import "../libraries/EfficiencyCalculator.sol";

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
 *
 * v2.0.0: Multi-Technology support - configurable thresholds per carbon
 * removal technology type (DAC, BECCS, Biochar, Enhanced Weathering, etc.)
 *
 * v3.0.0: Net-Negative Verification - replaces linear efficiency model with
 * Net-Negative Accounting: Credits = (CO2_gross × F_purity) − (Energy × Grid_Intensity).
 * Uses 1e18 precision (Wei-standard) to eliminate rounding dust.
 * Adds thermodynamic plausibility enforcement (100-800 kWh/tonne).
 * Non-linear purity penalty below 90%.
 */
contract VerificationEngine is
    Initializable,
    IVerificationEngine,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using EfficiencyCalculator for uint256;

    // ============ Technology Type Constants ============

    /**
     * @notice Technology type identifiers for carbon removal methods
     * @dev Each technology has unique energy/efficiency profiles
     */
    uint8 public constant TECH_DAC = 0;                  // Direct Air Capture
    uint8 public constant TECH_BECCS = 1;                // Bioenergy with CCS
    uint8 public constant TECH_BIOCHAR = 2;              // Biochar Carbon Removal
    uint8 public constant TECH_ENHANCED_WEATHERING = 3;  // Enhanced Mineral Weathering
    uint8 public constant TECH_OCEAN_ALKALINITY = 4;     // Ocean Alkalinity Enhancement

    /**
     * @notice Technology threshold configuration
     * @dev Each carbon removal technology has distinct physical constraints
     */
    struct TechThresholds {
        uint256 minKwhPerTonne;     // Minimum kWh/tonne (below = fraud)
        uint256 maxKwhPerTonne;     // Maximum kWh/tonne (above = too inefficient)
        uint256 optimalKwhPerTonne; // Optimal kWh/tonne (100% efficiency baseline)
        uint8 minPurityPercentage;  // Minimum CO2 purity required
        bool isActive;              // Whether this technology type is enabled
        string name;                // Human-readable technology name
    }

    // ============ Legacy Constants (backwards compatibility) ============

    /**
     * @notice Default DAC thresholds (kept as constants for backwards compatibility)
     * @dev These serve as defaults for TECH_DAC if no custom thresholds are set
     */
    uint256 public constant MIN_KWH_PER_TONNE = 200;
    uint256 public constant MAX_KWH_PER_TONNE = 600;
    uint256 public constant OPTIMAL_KWH_PER_TONNE = 350;
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

    /**
     * @notice Mapping of technology type ID to its verification thresholds
     */
    mapping(uint8 => TechThresholds) public techTypeThresholds;

    /**
     * @notice Mapping of DAC unit ID to its technology type
     */
    mapping(bytes32 => uint8) public dacUnitTechType;

    /**
     * @notice Number of registered technology types
     */
    uint8 public registeredTechCount;

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

    /**
     * @notice Emitted when technology thresholds are configured
     */
    event TechThresholdsUpdated(
        uint8 indexed techType,
        string name,
        uint256 minKwh,
        uint256 maxKwh,
        uint256 optimalKwh,
        uint8 minPurity
    );

    /**
     * @notice Emitted when a DAC unit's technology type is updated
     */
    event DacUnitTechTypeUpdated(
        bytes32 indexed dacUnitId,
        uint8 indexed oldTechType,
        uint8 indexed newTechType
    );

    // ============ Errors ============

    error UnauthorizedCaller();
    error DacUnitAlreadyWhitelisted();
    error DacUnitNotWhitelisted();
    error InvalidOperatorAddress();
    error InvalidCarbonCreditContract();
    error InvalidTechThresholds();
    error TechTypeNotActive();

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

        if (_accessControl == address(0)) {
            // Reserved for future access-control linkage while preserving
            // initializer ABI compatibility for existing deployments/tests.
        }

        if (_carbonCreditContract != address(0)) {
            carbonCreditContract = _carbonCreditContract;
        }

        // Initialize default DAC technology thresholds
        _initializeDefaultThresholds();
    }

    /**
     * @notice Set up default technology thresholds for backwards compatibility
     * @dev Called once during initialization. Sets DAC defaults matching legacy constants.
     */
    function _initializeDefaultThresholds() internal {
        // TECH_DAC (0) - Direct Air Capture (legacy defaults)
        techTypeThresholds[TECH_DAC] = TechThresholds({
            minKwhPerTonne: 200,
            maxKwhPerTonne: 600,
            optimalKwhPerTonne: 350,
            minPurityPercentage: 90,
            isActive: true,
            name: "Direct Air Capture"
        });

        // TECH_BECCS (1) - Bioenergy with Carbon Capture and Storage
        techTypeThresholds[TECH_BECCS] = TechThresholds({
            minKwhPerTonne: 100,
            maxKwhPerTonne: 400,
            optimalKwhPerTonne: 200,
            minPurityPercentage: 85,
            isActive: true,
            name: "BECCS"
        });

        // TECH_BIOCHAR (2) - Biochar Carbon Removal
        techTypeThresholds[TECH_BIOCHAR] = TechThresholds({
            minKwhPerTonne: 50,
            maxKwhPerTonne: 300,
            optimalKwhPerTonne: 150,
            minPurityPercentage: 70,
            isActive: true,
            name: "Biochar"
        });

        // TECH_ENHANCED_WEATHERING (3) - Enhanced Mineral Weathering
        techTypeThresholds[TECH_ENHANCED_WEATHERING] = TechThresholds({
            minKwhPerTonne: 30,
            maxKwhPerTonne: 200,
            optimalKwhPerTonne: 100,
            minPurityPercentage: 60,
            isActive: true,
            name: "Enhanced Weathering"
        });

        // TECH_OCEAN_ALKALINITY (4) - Ocean Alkalinity Enhancement
        techTypeThresholds[TECH_OCEAN_ALKALINITY] = TechThresholds({
            minKwhPerTonne: 40,
            maxKwhPerTonne: 250,
            optimalKwhPerTonne: 120,
            minPurityPercentage: 65,
            isActive: true,
            name: "Ocean Alkalinity"
        });

        registeredTechCount = 5;
    }

    // ============ External Functions ============

    /**
     * @inheritdoc IVerificationEngine
     * @dev Only callable by the CarbonCredit contract.
     *      v3.0.0: Now uses Net-Negative Accounting with grid intensity parameter.
     *      The efficiencyFactor returned is a legacy-compatible value derived from
     *      net credits so that CarbonCredit.sol can use `(co2 * factor) / SCALE`.
     */
    function verify(
        bytes32 dacUnitId,
        bytes32 sourceDataHash,
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage,
        uint256 gridIntensityGCO2PerKwh
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

        // Phase 2: Logic Check (Net-Negative Proof-of-Physics)
        (logicVerified, efficiencyFactor) = _verifyLogic(
            dacUnitId,
            sourceDataHash,
            co2AmountKg,
            energyConsumedKwh,
            purityPercentage,
            gridIntensityGCO2PerKwh
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
     * @notice Whitelist a DAC unit with default technology type (DAC)
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
        dacUnitTechType[dacUnitId] = TECH_DAC; // Default to DAC

        emit DacUnitWhitelisted(dacUnitId, operator, block.timestamp);
    }

    /**
     * @notice Whitelist a facility unit with a specific technology type
     * @param dacUnitId The unique identifier for the facility
     * @param operator The address of the facility operator
     * @param techType The technology type identifier
     */
    function whitelistDacUnitWithTech(
        bytes32 dacUnitId,
        address operator,
        uint8 techType
    ) external onlyOwner {
        if (whitelistedDacUnits[dacUnitId]) {
            revert DacUnitAlreadyWhitelisted();
        }
        if (operator == address(0)) {
            revert InvalidOperatorAddress();
        }
        if (!techTypeThresholds[techType].isActive) {
            revert TechTypeNotActive();
        }

        whitelistedDacUnits[dacUnitId] = true;
        dacUnitOperators[dacUnitId] = operator;
        dacUnitTechType[dacUnitId] = techType;

        emit DacUnitWhitelisted(dacUnitId, operator, block.timestamp);
        emit DacUnitTechTypeUpdated(dacUnitId, 0, techType);
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
     * @notice Update the technology type for a whitelisted DAC unit
     * @param dacUnitId The facility identifier
     * @param techType The new technology type
     */
    function setDacUnitTechType(
        bytes32 dacUnitId,
        uint8 techType
    ) external onlyOwner {
        if (!whitelistedDacUnits[dacUnitId]) {
            revert DacUnitNotWhitelisted();
        }
        if (!techTypeThresholds[techType].isActive) {
            revert TechTypeNotActive();
        }

        uint8 oldTechType = dacUnitTechType[dacUnitId];
        dacUnitTechType[dacUnitId] = techType;

        emit DacUnitTechTypeUpdated(dacUnitId, oldTechType, techType);
    }

    /**
     * @notice Configure or update thresholds for a technology type
     * @dev Used to add new carbon removal technologies or update existing ones.
     *      The thresholds define the physical constraints for each technology.
     * @param techType Technology type identifier
     * @param minKwh Minimum kWh per tonne (below = fraud indicator)
     * @param maxKwh Maximum kWh per tonne (above = too inefficient)
     * @param optimalKwh Optimal kWh per tonne (100% efficiency baseline)
     * @param minPurity Minimum CO2 purity percentage
     * @param name Human-readable technology name
     */
    function setTechThresholds(
        uint8 techType,
        uint256 minKwh,
        uint256 maxKwh,
        uint256 optimalKwh,
        uint8 minPurity,
        string calldata name
    ) external onlyOwner {
        // Validate threshold constraints
        if (minKwh >= optimalKwh || optimalKwh >= maxKwh) {
            revert InvalidTechThresholds();
        }
        if (bytes(name).length == 0) {
            revert InvalidTechThresholds();
        }

        bool wasActive = techTypeThresholds[techType].isActive;

        techTypeThresholds[techType] = TechThresholds({
            minKwhPerTonne: minKwh,
            maxKwhPerTonne: maxKwh,
            optimalKwhPerTonne: optimalKwh,
            minPurityPercentage: minPurity,
            isActive: true,
            name: name
        });

        if (!wasActive) {
            registeredTechCount++;
        }

        emit TechThresholdsUpdated(techType, name, minKwh, maxKwh, optimalKwh, minPurity);
    }

    /**
     * @notice Deactivate a technology type (no new verifications allowed)
     * @dev Existing verified credits remain valid. Does not affect whitelist status.
     * @param techType Technology type to deactivate
     */
    function deactivateTechType(uint8 techType) external onlyOwner {
        if (!techTypeThresholds[techType].isActive) {
            revert TechTypeNotActive();
        }
        techTypeThresholds[techType].isActive = false;
        registeredTechCount--;
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
     * @notice Phase 2: Verify the physics constraints using Net-Negative Accounting
     * @dev v3.0.0: Core "Proof-of-Physics" check now uses Net-Negative model:
     *      1. Thermodynamic plausibility check (100-800 kWh/tonne absolute limits)
     *      2. Technology-specific bounds check (configurable per tech type)
     *      3. Purity threshold check (per technology minimum)
     *      4. Net-Negative calculation: Credits = (CO2 × Purity) − (Energy × GridIntensity)
     *      5. Derive legacy-compatible efficiency factor for CarbonCredit.sol
     *
     * @param dacUnitId The DAC facility identifier
     * @param sourceDataHash The hash of the source data
     * @param co2AmountKg CO2 captured in kilograms
     * @param energyConsumedKwh Energy consumed in kilowatt-hours
     * @param purityPercentage CO2 purity (0-100)
     * @param gridIntensityGCO2PerKwh Grid carbon intensity in gCO2/kWh
     * @return verified Whether the logic verification passed
     * @return efficiencyFactor Legacy-compatible efficiency factor (scaled by 1e4)
     */
    function _verifyLogic(
        bytes32 dacUnitId,
        bytes32 sourceDataHash,
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage,
        uint256 gridIntensityGCO2PerKwh
    ) internal returns (bool verified, uint256 efficiencyFactor) {
        // Step 1: Thermodynamic plausibility check (absolute physical limits)
        (bool isPlausible, uint256 kwhPerTonne) = EfficiencyCalculator.isPhysicallyPlausible(
            co2AmountKg,
            energyConsumedKwh
        );

        if (!isPlausible) {
            emit VerificationPhaseCompleted(
                dacUnitId,
                sourceDataHash,
                "LOGIC",
                false,
                kwhPerTonne < 100
                    ? "Thermodynamically impossible - below 100 kWh/tonne"
                    : (co2AmountKg == 0
                        ? "Zero CO2 amount"
                        : "Thermodynamically implausible - above 800 kWh/tonne")
            );
            return (false, 0);
        }

        // Step 2: Technology-specific bounds check
        uint8 techType = dacUnitTechType[dacUnitId];
        TechThresholds storage thresholds = techTypeThresholds[techType];

        uint256 minKwh = thresholds.isActive ? thresholds.minKwhPerTonne : MIN_KWH_PER_TONNE;
        uint256 maxKwh = thresholds.isActive ? thresholds.maxKwhPerTonne : MAX_KWH_PER_TONNE;
        uint8 minPurity = thresholds.isActive ? thresholds.minPurityPercentage : MIN_PURITY_PERCENTAGE;

        if (kwhPerTonne < minKwh) {
            emit VerificationPhaseCompleted(
                dacUnitId,
                sourceDataHash,
                "LOGIC",
                false,
                "Suspiciously efficient - potential fraud"
            );
            return (false, 0);
        }

        if (kwhPerTonne > maxKwh) {
            emit VerificationPhaseCompleted(
                dacUnitId,
                sourceDataHash,
                "LOGIC",
                false,
                "Energy consumption too high"
            );
            return (false, 0);
        }

        // Step 3: Purity threshold check
        if (purityPercentage < minPurity) {
            emit VerificationPhaseCompleted(
                dacUnitId,
                sourceDataHash,
                "LOGIC",
                false,
                "Purity below minimum threshold"
            );
            return (false, 0);
        }

        // Step 4: Net-Negative Accounting calculation
        // Convert purity percentage (0-100) to basis points (0-10000)
        uint256 purityBps = uint256(purityPercentage) * 100;

        (
            uint256 netCreditsScaled,
            ,  // grossCredits (not used here)
            ,  // energyDebtKg (not used here)
               // purityFactor (not used here)
        ) = EfficiencyCalculator.calculateNetCredits(
            co2AmountKg,
            energyConsumedKwh,
            purityBps,
            gridIntensityGCO2PerKwh
        );

        // Check that net credits are positive (not net-negative)
        if (netCreditsScaled == 0) {
            emit VerificationPhaseCompleted(
                dacUnitId,
                sourceDataHash,
                "LOGIC",
                false,
                "Net-negative: energy debt exceeds gross capture"
            );
            return (false, 0);
        }

        // Step 5: Derive legacy-compatible efficiency factor
        // This allows CarbonCredit.sol to use: creditsToMint = (co2AmountKg * efficiencyFactor) / SCALE
        efficiencyFactor = EfficiencyCalculator.toLegacyEfficiencyFactor(
            netCreditsScaled,
            co2AmountKg
        );

        // Ensure minimum floor: if net credits exist but factor rounds to 0,
        // set to minimum 1 to ensure at least some credits are minted
        if (efficiencyFactor == 0 && netCreditsScaled > 0) {
            efficiencyFactor = 1;
        }

        emit VerificationPhaseCompleted(
            dacUnitId,
            sourceDataHash,
            "LOGIC",
            true,
            "Net-Negative physics constraints verified"
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
     * @notice Get verification thresholds (legacy - returns DAC defaults)
     * @dev DEPRECATED: Use getTechThresholds() for technology-specific thresholds
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
     * @notice Get thresholds for a specific technology type
     * @param techType The technology type identifier
     * @return thresholds The technology-specific thresholds
     */
    function getTechThresholds(uint8 techType)
        external
        view
        returns (TechThresholds memory thresholds)
    {
        return techTypeThresholds[techType];
    }

    /**
     * @notice Get the effective thresholds that would be used for a specific DAC unit
     * @param dacUnitId The facility identifier
     * @return minKwh Effective minimum kWh per tonne
     * @return maxKwh Effective maximum kWh per tonne
     * @return optimalKwh Effective optimal kWh per tonne
     * @return minPurity Effective minimum purity
     * @return techType The technology type assigned
     * @return techName The technology name
     */
    function getEffectiveThresholds(bytes32 dacUnitId)
        external
        view
        returns (
            uint256 minKwh,
            uint256 maxKwh,
            uint256 optimalKwh,
            uint8 minPurity,
            uint8 techType,
            string memory techName
        )
    {
        techType = dacUnitTechType[dacUnitId];
        TechThresholds storage t = techTypeThresholds[techType];

        if (t.isActive) {
            return (t.minKwhPerTonne, t.maxKwhPerTonne, t.optimalKwhPerTonne,
                    t.minPurityPercentage, techType, t.name);
        }
        return (MIN_KWH_PER_TONNE, MAX_KWH_PER_TONNE, OPTIMAL_KWH_PER_TONNE,
                MIN_PURITY_PERCENTAGE, TECH_DAC, "Direct Air Capture");
    }

    /**
     * @notice Preview efficiency factor calculation without state changes (legacy - uses DAC defaults)
     * @dev DEPRECATED: Use previewNetNegativeCredits() for Net-Negative preview.
     *      This legacy function now uses a default grid intensity of 400 gCO2/kWh
     *      (global average) internally but returns a legacy efficiency factor.
     */
    function previewEfficiencyFactor(
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage
    ) external pure returns (bool isValid, uint256 efficiencyFactor) {
        if (purityPercentage < MIN_PURITY_PERCENTAGE) {
            return (false, 0);
        }

        // Thermodynamic plausibility check
        (bool isPlausible, uint256 kwhPerTonne) = EfficiencyCalculator.isPhysicallyPlausible(
            co2AmountKg,
            energyConsumedKwh
        );
        if (!isPlausible) {
            return (false, 0);
        }

        if (kwhPerTonne < MIN_KWH_PER_TONNE || kwhPerTonne > MAX_KWH_PER_TONNE) {
            return (false, 0);
        }

        // Use Net-Negative calculation with default global average grid intensity
        uint256 purityBps = uint256(purityPercentage) * 100;
        uint256 defaultGridIntensity = 400; // Global average gCO2/kWh

        (uint256 netCreditsScaled, , , ) = EfficiencyCalculator.calculateNetCredits(
            co2AmountKg,
            energyConsumedKwh,
            purityBps,
            defaultGridIntensity
        );

        if (netCreditsScaled == 0) {
            return (false, 0);
        }

        efficiencyFactor = EfficiencyCalculator.toLegacyEfficiencyFactor(
            netCreditsScaled,
            co2AmountKg
        );

        if (efficiencyFactor == 0 && netCreditsScaled > 0) {
            efficiencyFactor = 1;
        }

        return (true, efficiencyFactor);
    }

    /**
     * @notice Preview Net-Negative credits calculation with explicit grid intensity
     * @param co2AmountKg CO2 captured in kilograms
     * @param energyConsumedKwh Energy consumed in kilowatt-hours
     * @param purityPercentage CO2 purity (0-100)
     * @param gridIntensityGCO2PerKwh Grid carbon intensity in gCO2/kWh
     * @return isValid Whether the values would pass verification
     * @return netCreditsKg Net credits in kg (integer, ready for minting)
     * @return efficiencyFactor Legacy-compatible efficiency factor (scaled by 1e4)
     * @return grossCreditsScaled Gross credits at 1e18 precision
     * @return energyDebtScaled Energy debt at 1e18 precision
     */
    function previewNetNegativeCredits(
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage,
        uint256 gridIntensityGCO2PerKwh
    ) external pure returns (
        bool isValid,
        uint256 netCreditsKg,
        uint256 efficiencyFactor,
        uint256 grossCreditsScaled,
        uint256 energyDebtScaled
    ) {
        // Thermodynamic check
        (bool isPlausible, ) = EfficiencyCalculator.isPhysicallyPlausible(
            co2AmountKg,
            energyConsumedKwh
        );
        if (!isPlausible) {
            return (false, 0, 0, 0, 0);
        }

        uint256 purityBps = uint256(purityPercentage) * 100;

        (
            uint256 netCreditsScaled,
            uint256 grossScaled,
            uint256 debtScaled,
        ) = EfficiencyCalculator.calculateNetCredits(
            co2AmountKg,
            energyConsumedKwh,
            purityBps,
            gridIntensityGCO2PerKwh
        );

        if (netCreditsScaled == 0) {
            return (false, 0, 0, grossScaled, debtScaled);
        }

        netCreditsKg = EfficiencyCalculator.scaleToMintable(netCreditsScaled);
        efficiencyFactor = EfficiencyCalculator.toLegacyEfficiencyFactor(netCreditsScaled, co2AmountKg);

        return (true, netCreditsKg, efficiencyFactor, grossScaled, debtScaled);
    }

    /**
     * @notice Preview efficiency factor for a specific technology type with grid intensity
     * @dev v3.0.0: Now accepts gridIntensity parameter for Net-Negative calculation.
     *      Defaults to 400 gCO2/kWh (global average) if gridIntensity is 0.
     * @param techType The technology type to use for thresholds
     * @param co2AmountKg CO2 captured in kilograms
     * @param energyConsumedKwh Energy consumed in kilowatt-hours
     * @param purityPercentage CO2 purity (0-100)
     * @return isValid Whether the values would pass verification
     * @return efficiencyFactor The calculated efficiency factor (legacy-compatible, 1e4 scale)
     */
    function previewEfficiencyFactorForTech(
        uint8 techType,
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint8 purityPercentage
    ) external view returns (bool isValid, uint256 efficiencyFactor) {
        TechThresholds storage t = techTypeThresholds[techType];
        if (!t.isActive) {
            return (false, 0);
        }

        if (purityPercentage < t.minPurityPercentage) {
            return (false, 0);
        }

        // Thermodynamic plausibility check
        (bool isPlausible, uint256 kwhPerTonne) = EfficiencyCalculator.isPhysicallyPlausible(
            co2AmountKg,
            energyConsumedKwh
        );
        if (!isPlausible) {
            return (false, 0);
        }

        if (kwhPerTonne < t.minKwhPerTonne || kwhPerTonne > t.maxKwhPerTonne) {
            return (false, 0);
        }

        // Net-Negative calculation with default grid intensity
        uint256 purityBps = uint256(purityPercentage) * 100;
        uint256 defaultGridIntensity = 400; // Global average gCO2/kWh

        (uint256 netCreditsScaled, , , ) = EfficiencyCalculator.calculateNetCredits(
            co2AmountKg,
            energyConsumedKwh,
            purityBps,
            defaultGridIntensity
        );

        if (netCreditsScaled == 0) {
            return (false, 0);
        }

        efficiencyFactor = EfficiencyCalculator.toLegacyEfficiencyFactor(netCreditsScaled, co2AmountKg);

        if (efficiencyFactor == 0 && netCreditsScaled > 0) {
            efficiencyFactor = 1;
        }

        return (true, efficiencyFactor);
    }
}
