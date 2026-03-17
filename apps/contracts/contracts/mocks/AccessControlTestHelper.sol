// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../access/TerraQuraAccessControl.sol";

/**
 * @title AccessControlTestHelper
 * @notice Helper contract to test TerraQuraAccessControl modifiers
 * @dev Exposes functions that use the onlyKycVerified and onlySanctionsCleared modifiers
 */
contract AccessControlTestHelper {
    TerraQuraAccessControl public accessControl;

    constructor(address _accessControl) {
        accessControl = TerraQuraAccessControl(_accessControl);
    }

    /**
     * @notice Test function that requires KYC verification via AccessControl
     */
    function doSomethingRequiringKyc(address account) external view returns (bool) {
        require(accessControl.isKycVerified(account), "KYC not verified");
        return true;
    }

    /**
     * @notice Test function that requires sanctions clearance
     */
    function doSomethingRequiringSanctions(address account) external view returns (bool) {
        (,,,, bool sanctionsCleared,) = accessControl.getKycInfo(account);
        require(sanctionsCleared, "Sanctions not cleared");
        return true;
    }
}
