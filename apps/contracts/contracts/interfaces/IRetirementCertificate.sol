// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/**
 * @title IRetirementCertificate
 * @notice Interface for the TerraQura Retirement Certificate NFT
 * @dev ERC-721 on-chain certificates proving permanent carbon credit retirement
 */
interface IRetirementCertificate {
    /**
     * @notice Certificate data stored on-chain
     */
    struct CertificateData {
        uint256 retirementId;
        uint256 creditId;
        uint256 amount;         // tonnes CO2
        string beneficiary;
        string reason;
        uint256 timestamp;
        string methodology;
        string vintage;
    }

    /**
     * @notice Emitted when a certificate NFT is minted
     */
    event CertificateMinted(
        uint256 indexed tokenId,
        uint256 indexed retirementId,
        address indexed recipient
    );

    /**
     * @notice Mint a retirement certificate NFT
     * @param to Recipient address
     * @param retirementId The associated retirement record ID
     * @param data Certificate metadata
     * @return tokenId The minted token ID
     */
    function mint(
        address to,
        uint256 retirementId,
        CertificateData calldata data
    ) external returns (uint256 tokenId);

    /**
     * @notice Get certificate data for a token
     * @param tokenId The token ID
     * @return data The certificate data
     */
    function getCertificateData(uint256 tokenId) external view returns (CertificateData memory data);

    /**
     * @notice Set soulbound mode (prevents transfers when enabled)
     * @param enabled Whether soulbound mode is enabled
     */
    function setSoulbound(bool enabled) external;

    /**
     * @notice Get total number of certificates minted
     * @return Total certificate count
     */
    function totalCertificates() external view returns (uint256);
}
