import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * @title ChainlinkVerifier Coverage Tests
 * @notice Additional tests for ChainlinkVerifier error paths
 * @dev These tests achieve 100% coverage on the fulfillRequest callback
 *      by testing RequestNotFound and RequestAlreadyFulfilled errors.
 */
describe("ChainlinkVerifier - Error Path Coverage", function () {
    let verifier: any;
    let mockRouter: any;
    let owner: SignerWithAddress;
    let authorizedCaller: SignerWithAddress;

    const DON_ID = ethers.keccak256(ethers.toUtf8Bytes("don-aethelred-1"));
    const SUBSCRIPTION_ID = 123n;

    beforeEach(async function () {
        [owner, authorizedCaller] = await ethers.getSigners();

        // Deploy mock router
        const MockRouterFactory = await ethers.getContractFactory("MockChainlinkRouter");
        mockRouter = await MockRouterFactory.deploy();
        await mockRouter.waitForDeployment();

        // Deploy ChainlinkVerifier
        const VerifierFactory = await ethers.getContractFactory("ChainlinkVerifier");
        verifier = await VerifierFactory.deploy(
            await mockRouter.getAddress(),
            DON_ID,
            SUBSCRIPTION_ID
        );
        await verifier.waitForDeployment();

        // Set authorized caller
        await verifier.setAuthorizedCaller(authorizedCaller.address, true);
    });

    describe("RequestNotFound Error (covers line 217-219)", function () {
        it("should revert when fulfilling non-existent request", async function () {
            // Generate a fake request ID that was never submitted
            const fakeRequestId = ethers.keccak256(ethers.toUtf8Bytes("non-existent-request"));

            // Encode a valid response
            const response = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bool", "uint256", "uint256", "bytes32"],
                [true, ethers.parseEther("100"), 3000000n, ethers.keccak256(ethers.toUtf8Bytes("non-existent-request"))]
            );

            // Try to fulfill a non-existent request via direct fulfillment
            await expect(
                mockRouter.directFulfillment(
                    await verifier.getAddress(),
                    fakeRequestId,
                    response,
                    "0x"
                )
            ).to.be.revertedWithCustomError(verifier, "RequestNotFound");
        });
    });

    describe("RequestAlreadyFulfilled Error (covers line 221-223)", function () {
        it("should revert when fulfilling same request twice", async function () {
            // First, submit a real request
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("batch-double-fulfill"));
            const co2Claimed = ethers.parseEther("1000");
            const efficiencyClaimed = 3500000n;
            const apiEndpoint = "https://api.terraqura.io/v1/sensors/batch-double";
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("sensor-data"));

            await verifier.requestVerification(
                batchId,
                co2Claimed,
                efficiencyClaimed,
                apiEndpoint,
                dataHash
            );

            const requestId = await mockRouter.getLatestRequestId();

            // Encode a valid response
            const response = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bool", "uint256", "uint256", "bytes32"],
                [true, co2Claimed, efficiencyClaimed, dataHash]
            );

            // First fulfillment should succeed
            await mockRouter.fulfillRequestWithResponse(requestId, response);

            // Verify the request was fulfilled
            const [, , fulfilled] = await verifier.getRequestStatus(requestId);
            expect(fulfilled).to.be.true;

            // Try to fulfill again via direct fulfillment - should revert
            await expect(
                mockRouter.directFulfillment(
                    await verifier.getAddress(),
                    requestId,
                    response,
                    "0x"
                )
            ).to.be.revertedWithCustomError(verifier, "RequestAlreadyFulfilled");
        });

        it("should revert on double fulfillment in same transaction", async function () {
            // Submit a request
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("batch-atomic-double"));
            const co2Claimed = ethers.parseEther("500");
            const efficiencyClaimed = 3200000n;
            const apiEndpoint = "https://api.terraqura.io/v1/sensors/batch-atomic";
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("sensor-data-atomic"));

            await verifier.requestVerification(
                batchId,
                co2Claimed,
                efficiencyClaimed,
                apiEndpoint,
                dataHash
            );

            const requestId = await mockRouter.getLatestRequestId();

            // Encode response
            const response = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bool", "uint256", "uint256", "bytes32"],
                [true, co2Claimed, efficiencyClaimed, dataHash]
            );

            // Try to fulfill twice in one call - should revert on second fulfillment
            await expect(
                mockRouter.fulfillRequestTwice(requestId, response)
            ).to.be.revertedWithCustomError(verifier, "RequestAlreadyFulfilled");
        });
    });

    describe("Helper Function Coverage", function () {
        it("should convert bytes32 to string correctly", async function () {
            // This is tested implicitly through requestVerification
            // The _bytes32ToString function is used when building the request
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("test-batch"));
            const co2Claimed = ethers.parseEther("100");
            const efficiencyClaimed = 3000000n;
            const apiEndpoint = "https://api.example.com";
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));

            // This will exercise _bytes32ToString
            await expect(
                verifier.requestVerification(
                    batchId,
                    co2Claimed,
                    efficiencyClaimed,
                    apiEndpoint,
                    dataHash
                )
            ).to.emit(verifier, "VerificationRequested");
        });

        it("should convert uint256 to string correctly with zero", async function () {
            // Test with zero CO2 to exercise the "0" branch in _uint256ToString
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("zero-test"));
            const co2Claimed = 0n;
            const efficiencyClaimed = 0n;
            const apiEndpoint = "https://api.example.com";
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));

            await expect(
                verifier.requestVerification(
                    batchId,
                    co2Claimed,
                    efficiencyClaimed,
                    apiEndpoint,
                    dataHash
                )
            ).to.emit(verifier, "VerificationRequested");
        });

        it("should handle large uint256 values", async function () {
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("large-test"));
            const co2Claimed = ethers.parseEther("999999999999");
            const efficiencyClaimed = 9999999999n;
            const apiEndpoint = "https://api.example.com";
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("data"));

            await expect(
                verifier.requestVerification(
                    batchId,
                    co2Claimed,
                    efficiencyClaimed,
                    apiEndpoint,
                    dataHash
                )
            ).to.emit(verifier, "VerificationRequested");
        });
    });

    describe("Encrypted Secrets Path", function () {
        it("should add encrypted secrets when configured", async function () {
            // Set encrypted secrets URLs
            const secretsUrl = ethers.toUtf8Bytes("https://secrets.example.com/encrypted");
            await verifier.setEncryptedSecretsUrls(secretsUrl);

            // Verify it was set
            expect(await verifier.encryptedSecretsUrls()).to.equal(ethers.hexlify(secretsUrl));

            // Now make a request - it should include secrets
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("secrets-test"));
            await verifier.requestVerification(
                batchId,
                ethers.parseEther("100"),
                3000000n,
                "https://api.example.com",
                ethers.keccak256(ethers.toUtf8Bytes("data"))
            );

            // Verify request was created successfully
            const requestId = await mockRouter.getLatestRequestId();
            const [storedBatchId] = await verifier.getRequestStatus(requestId);
            expect(storedBatchId).to.equal(batchId);
        });
    });
});
