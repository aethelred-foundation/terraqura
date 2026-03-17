import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ChainlinkVerifier, MockChainlinkRouter } from "../typechain-types";

describe("ChainlinkVerifier", function () {
    let verifier: ChainlinkVerifier;
    let mockRouter: MockChainlinkRouter;
    let owner: SignerWithAddress;
    let authorizedCaller: SignerWithAddress;
    let unauthorized: SignerWithAddress;

    const DON_ID = ethers.keccak256(ethers.toUtf8Bytes("don-aethelred-1"));
    const SUBSCRIPTION_ID = 123n;

    beforeEach(async function () {
        [owner, authorizedCaller, unauthorized] = await ethers.getSigners();

        // Deploy mock router
        const MockRouterFactory = await ethers.getContractFactory("MockChainlinkRouter");
        mockRouter = await MockRouterFactory.deploy() as unknown as MockChainlinkRouter;
        await mockRouter.waitForDeployment();

        // Deploy ChainlinkVerifier
        const VerifierFactory = await ethers.getContractFactory("ChainlinkVerifier");
        verifier = await VerifierFactory.deploy(
            await mockRouter.getAddress(),
            DON_ID,
            SUBSCRIPTION_ID
        ) as unknown as ChainlinkVerifier;
        await verifier.waitForDeployment();

        // Set authorized caller
        await verifier.setAuthorizedCaller(authorizedCaller.address, true);
    });

    describe("Deployment", function () {
        it("should set correct DON ID", async function () {
            expect(await verifier.donId()).to.equal(DON_ID);
        });

        it("should set correct subscription ID", async function () {
            expect(await verifier.subscriptionId()).to.equal(SUBSCRIPTION_ID);
        });

        it("should set correct owner", async function () {
            expect(await verifier.owner()).to.equal(owner.address);
        });

        it("should set default gas limit", async function () {
            expect(await verifier.gasLimit()).to.equal(300000);
        });

        it("should have default verification source", async function () {
            const source = await verifier.verificationSource();
            expect(source.length).to.be.gt(0);
        });
    });

    describe("Admin Functions", function () {
        describe("setDonId", function () {
            it("should update DON ID", async function () {
                const newDonId = ethers.keccak256(ethers.toUtf8Bytes("new-don"));
                await verifier.setDonId(newDonId);
                expect(await verifier.donId()).to.equal(newDonId);
            });

            it("should only allow owner", async function () {
                const newDonId = ethers.keccak256(ethers.toUtf8Bytes("new-don"));
                await expect(
                    verifier.connect(unauthorized).setDonId(newDonId)
                ).to.be.reverted;
            });
        });

        describe("setSubscriptionId", function () {
            it("should update subscription ID", async function () {
                const newSubId = 456n;
                await verifier.setSubscriptionId(newSubId);
                expect(await verifier.subscriptionId()).to.equal(newSubId);
            });

            it("should only allow owner", async function () {
                await expect(
                    verifier.connect(unauthorized).setSubscriptionId(456n)
                ).to.be.reverted;
            });
        });

        describe("setGasLimit", function () {
            it("should update gas limit", async function () {
                const newLimit = 500000;
                await verifier.setGasLimit(newLimit);
                expect(await verifier.gasLimit()).to.equal(newLimit);
            });

            it("should only allow owner", async function () {
                await expect(
                    verifier.connect(unauthorized).setGasLimit(500000)
                ).to.be.reverted;
            });
        });

        describe("setVerificationSource", function () {
            it("should update verification source", async function () {
                const newSource = "return 1;";
                await verifier.setVerificationSource(newSource);
                expect(await verifier.verificationSource()).to.equal(newSource);
            });

            it("should only allow owner", async function () {
                await expect(
                    verifier.connect(unauthorized).setVerificationSource("return 1;")
                ).to.be.reverted;
            });
        });

        describe("setEncryptedSecretsUrls", function () {
            it("should update encrypted secrets URLs", async function () {
                const urls = ethers.toUtf8Bytes("https://secrets.example.com");
                await verifier.setEncryptedSecretsUrls(urls);
                expect(await verifier.encryptedSecretsUrls()).to.equal(ethers.hexlify(urls));
            });

            it("should only allow owner", async function () {
                const urls = ethers.toUtf8Bytes("https://secrets.example.com");
                await expect(
                    verifier.connect(unauthorized).setEncryptedSecretsUrls(urls)
                ).to.be.reverted;
            });
        });

        describe("setAuthorizedCaller", function () {
            it("should authorize caller", async function () {
                await verifier.setAuthorizedCaller(unauthorized.address, true);
                expect(await verifier.authorizedCallers(unauthorized.address)).to.be.true;
            });

            it("should revoke caller authorization", async function () {
                await verifier.setAuthorizedCaller(authorizedCaller.address, false);
                expect(await verifier.authorizedCallers(authorizedCaller.address)).to.be.false;
            });

            it("should only allow owner", async function () {
                await expect(
                    verifier.connect(unauthorized).setAuthorizedCaller(unauthorized.address, true)
                ).to.be.reverted;
            });
        });
    });

    describe("Verification Request", function () {
        const batchId = ethers.keccak256(ethers.toUtf8Bytes("batch-001"));
        const co2Claimed = ethers.parseEther("1000"); // 1000 kg
        const efficiencyClaimed = 3500000n; // 350 kWh/tonne * 10000
        const apiEndpoint = "https://api.terraqura.io/v1/sensors/batch-001";
        const dataHash = ethers.keccak256(ethers.toUtf8Bytes("sensor-data"));

        it("should create verification request from owner", async function () {
            const tx = await verifier.requestVerification(
                batchId,
                co2Claimed,
                efficiencyClaimed,
                apiEndpoint,
                dataHash
            );

            const receipt = await tx.wait();
            expect(receipt).to.not.be.null;

            // Check event emitted
            await expect(tx).to.emit(verifier, "VerificationRequested");
        });

        it("should create verification request from authorized caller", async function () {
            const tx = await verifier.connect(authorizedCaller).requestVerification(
                batchId,
                co2Claimed,
                efficiencyClaimed,
                apiEndpoint,
                dataHash
            );

            await expect(tx).to.emit(verifier, "VerificationRequested");
        });

        it("should revert from unauthorized caller", async function () {
            await expect(
                verifier.connect(unauthorized).requestVerification(
                    batchId,
                    co2Claimed,
                    efficiencyClaimed,
                    apiEndpoint,
                    dataHash
                )
            ).to.be.revertedWithCustomError(verifier, "UnauthorizedCaller");
        });

        it("should revert with empty batch ID", async function () {
            await expect(
                verifier.requestVerification(
                    ethers.ZeroHash,
                    co2Claimed,
                    efficiencyClaimed,
                    apiEndpoint,
                    dataHash
                )
            ).to.be.revertedWithCustomError(verifier, "InvalidBatchId");
        });

        it("should store request details", async function () {
            await verifier.requestVerification(
                batchId,
                co2Claimed,
                efficiencyClaimed,
                apiEndpoint,
                dataHash
            );

            const requestId = await mockRouter.getLatestRequestId();
            const [storedBatchId, operator, fulfilled, passed] = await verifier.getRequestStatus(requestId);

            expect(storedBatchId).to.equal(batchId);
            expect(operator).to.equal(owner.address);
            expect(fulfilled).to.be.false;
            expect(passed).to.be.false;
        });

        it("should map batch to request", async function () {
            await verifier.requestVerification(
                batchId,
                co2Claimed,
                efficiencyClaimed,
                apiEndpoint,
                dataHash
            );

            const requestId = await mockRouter.getLatestRequestId();
            const mappedRequestId = await verifier.batchToRequest(batchId);

            expect(mappedRequestId).to.equal(requestId);
        });
    });

    describe("Verification Fulfillment", function () {
        const batchId = ethers.keccak256(ethers.toUtf8Bytes("batch-002"));
        const co2Claimed = ethers.parseEther("1000");
        const efficiencyClaimed = 3500000n;
        const apiEndpoint = "https://api.terraqura.io/v1/sensors/batch-002";
        const dataHash = ethers.keccak256(ethers.toUtf8Bytes("sensor-data-2"));

        let requestId: string;

        beforeEach(async function () {
            await verifier.requestVerification(
                batchId,
                co2Claimed,
                efficiencyClaimed,
                apiEndpoint,
                dataHash
            );
            requestId = await mockRouter.getLatestRequestId();
        });

        it("should fulfill request with success", async function () {
            const co2Verified = ethers.parseEther("995"); // Within 5% tolerance
            const efficiencyVerified = 3450000n;
            const verifiedHash = ethers.keccak256(ethers.toUtf8Bytes("verified-data"));

            // Encode response: (bool passed, uint256 co2Verified, uint256 efficiencyVerified, bytes32 dataHash)
            const response = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bool", "uint256", "uint256", "bytes32"],
                [true, co2Verified, efficiencyVerified, verifiedHash]
            );

            await expect(
                mockRouter.fulfillRequestWithResponse(requestId, response)
            ).to.emit(verifier, "VerificationFulfilled");

            // Check request is fulfilled
            const [, , fulfilled, passed] = await verifier.getRequestStatus(requestId);
            expect(fulfilled).to.be.true;
            expect(passed).to.be.true;

            // Check result stored
            const result = await verifier.getVerificationResult(batchId);
            expect(result.verified).to.be.true;
            expect(result.co2Verified).to.equal(co2Verified);
            expect(result.efficiencyVerified).to.equal(efficiencyVerified);
        });

        it("should fulfill request with failure", async function () {
            const response = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bool", "uint256", "uint256", "bytes32"],
                [false, 0, 0, ethers.ZeroHash]
            );

            await mockRouter.fulfillRequestWithResponse(requestId, response);

            const [, , fulfilled, passed] = await verifier.getRequestStatus(requestId);
            expect(fulfilled).to.be.true;
            expect(passed).to.be.false;

            const result = await verifier.getVerificationResult(batchId);
            expect(result.verified).to.be.false;
        });

        it("should handle error response", async function () {
            const errorBytes = ethers.toUtf8Bytes("API request failed");

            await expect(
                mockRouter.fulfillRequestWithError(requestId, errorBytes)
            ).to.emit(verifier, "VerificationFailed");

            const [, , fulfilled, passed] = await verifier.getRequestStatus(requestId);
            expect(fulfilled).to.be.true;
            expect(passed).to.be.false;
        });
    });

    describe("View Functions", function () {
        const batchId = ethers.keccak256(ethers.toUtf8Bytes("batch-003"));
        const co2Claimed = ethers.parseEther("500");
        const efficiencyClaimed = 3200000n;
        const apiEndpoint = "https://api.terraqura.io/v1/sensors/batch-003";
        const dataHash = ethers.keccak256(ethers.toUtf8Bytes("sensor-data-3"));

        beforeEach(async function () {
            await verifier.requestVerification(
                batchId,
                co2Claimed,
                efficiencyClaimed,
                apiEndpoint,
                dataHash
            );
        });

        describe("getVerificationResult", function () {
            it("should return empty result for unfulfilled batch", async function () {
                const result = await verifier.getVerificationResult(batchId);
                expect(result.verified).to.be.false;
                expect(result.timestamp).to.equal(0);
            });

            it("should return result after fulfillment", async function () {
                const requestId = await mockRouter.getLatestRequestId();
                const co2Verified = ethers.parseEther("500");
                const efficiencyVerified = 3200000n;
                const verifiedHash = dataHash;

                const response = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bool", "uint256", "uint256", "bytes32"],
                    [true, co2Verified, efficiencyVerified, verifiedHash]
                );

                await mockRouter.fulfillRequestWithResponse(requestId, response);

                const result = await verifier.getVerificationResult(batchId);
                expect(result.verified).to.be.true;
                expect(result.co2Verified).to.equal(co2Verified);
                expect(result.timestamp).to.be.gt(0);
            });
        });

        describe("isVerified", function () {
            it("should return false for unfulfilled batch", async function () {
                expect(await verifier.isVerified(batchId)).to.be.false;
            });

            it("should return true after successful verification", async function () {
                const requestId = await mockRouter.getLatestRequestId();
                const response = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bool", "uint256", "uint256", "bytes32"],
                    [true, co2Claimed, efficiencyClaimed, dataHash]
                );

                await mockRouter.fulfillRequestWithResponse(requestId, response);

                expect(await verifier.isVerified(batchId)).to.be.true;
            });

            it("should return false after failed verification", async function () {
                const requestId = await mockRouter.getLatestRequestId();
                const response = ethers.AbiCoder.defaultAbiCoder().encode(
                    ["bool", "uint256", "uint256", "bytes32"],
                    [false, 0, 0, ethers.ZeroHash]
                );

                await mockRouter.fulfillRequestWithResponse(requestId, response);

                expect(await verifier.isVerified(batchId)).to.be.false;
            });
        });

        describe("getRequestStatus", function () {
            it("should return request status", async function () {
                const requestId = await mockRouter.getLatestRequestId();
                const [storedBatchId, operator, fulfilled, passed] = await verifier.getRequestStatus(requestId);

                expect(storedBatchId).to.equal(batchId);
                expect(operator).to.equal(owner.address);
                expect(fulfilled).to.be.false;
                expect(passed).to.be.false;
            });

            it("should return empty for non-existent request", async function () {
                const fakeRequestId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
                const [storedBatchId, operator, fulfilled, passed] = await verifier.getRequestStatus(fakeRequestId);

                expect(storedBatchId).to.equal(ethers.ZeroHash);
                expect(operator).to.equal(ethers.ZeroAddress);
                expect(fulfilled).to.be.false;
                expect(passed).to.be.false;
            });
        });
    });

    describe("Multiple Batches", function () {
        it("should handle multiple verification requests", async function () {
            const batches = [
                ethers.keccak256(ethers.toUtf8Bytes("batch-a")),
                ethers.keccak256(ethers.toUtf8Bytes("batch-b")),
                ethers.keccak256(ethers.toUtf8Bytes("batch-c"))
            ];

            for (const batchId of batches) {
                await verifier.requestVerification(
                    batchId,
                    ethers.parseEther("100"),
                    3000000n,
                    "https://api.example.com",
                    ethers.keccak256(ethers.toUtf8Bytes("data"))
                );
            }

            // Each batch should have its own request
            for (const batchId of batches) {
                const requestId = await verifier.batchToRequest(batchId);
                expect(requestId).to.not.equal(ethers.ZeroHash);
            }
        });

        it("should handle mixed verification results", async function () {
            const batch1 = ethers.keccak256(ethers.toUtf8Bytes("batch-pass"));
            const batch2 = ethers.keccak256(ethers.toUtf8Bytes("batch-fail"));

            await verifier.requestVerification(
                batch1,
                ethers.parseEther("100"),
                3000000n,
                "https://api.example.com",
                ethers.keccak256(ethers.toUtf8Bytes("data1"))
            );
            const requestId1 = await mockRouter.getLatestRequestId();

            await verifier.requestVerification(
                batch2,
                ethers.parseEther("100"),
                3000000n,
                "https://api.example.com",
                ethers.keccak256(ethers.toUtf8Bytes("data2"))
            );
            const requestId2 = await mockRouter.getLatestRequestId();

            // Fulfill batch1 as passed
            const successResponse = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bool", "uint256", "uint256", "bytes32"],
                [true, ethers.parseEther("100"), 3000000n, ethers.keccak256(ethers.toUtf8Bytes("data1"))]
            );
            await mockRouter.fulfillRequestWithResponse(requestId1, successResponse);

            // Fulfill batch2 as failed
            const failResponse = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bool", "uint256", "uint256", "bytes32"],
                [false, 0, 0, ethers.ZeroHash]
            );
            await mockRouter.fulfillRequestWithResponse(requestId2, failResponse);

            expect(await verifier.isVerified(batch1)).to.be.true;
            expect(await verifier.isVerified(batch2)).to.be.false;
        });
    });

    describe("Edge Cases", function () {
        it("should handle zero CO2 claimed", async function () {
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("zero-co2"));

            await verifier.requestVerification(
                batchId,
                0, // Zero CO2
                3500000n,
                "https://api.example.com",
                ethers.keccak256(ethers.toUtf8Bytes("data"))
            );

            const requestId = await verifier.batchToRequest(batchId);
            expect(requestId).to.not.equal(ethers.ZeroHash);
        });

        it("should handle maximum efficiency value", async function () {
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("max-eff"));

            await verifier.requestVerification(
                batchId,
                ethers.parseEther("1000"),
                6000000n, // 600 kWh/tonne (maximum)
                "https://api.example.com",
                ethers.keccak256(ethers.toUtf8Bytes("data"))
            );

            const requestId = await verifier.batchToRequest(batchId);
            expect(requestId).to.not.equal(ethers.ZeroHash);
        });

        it("should handle minimum efficiency value", async function () {
            const batchId = ethers.keccak256(ethers.toUtf8Bytes("min-eff"));

            await verifier.requestVerification(
                batchId,
                ethers.parseEther("1000"),
                2000000n, // 200 kWh/tonne (minimum)
                "https://api.example.com",
                ethers.keccak256(ethers.toUtf8Bytes("data"))
            );

            const requestId = await verifier.batchToRequest(batchId);
            expect(requestId).to.not.equal(ethers.ZeroHash);
        });
    });
});
