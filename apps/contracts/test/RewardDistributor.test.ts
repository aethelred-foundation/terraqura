import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { RewardDistributor, TerraQuraAccessControl } from "../typechain-types";
import { MerkleTree } from "merkletreejs";

// Helper to build merkle tree for airdrop
function buildMerkleTree(entries: { address: string; amount: bigint }[]) {
    const leaves = entries.map((e) =>
        ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32"],
                [ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [e.address, e.amount]))]
            )
        )
    );
    // Actually we need the double hash approach used in the contract:
    // leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))))
    const leavesCorrect = entries.map((e) => {
        const inner = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [e.address, e.amount])
        );
        return ethers.keccak256(ethers.solidityPacked(["bytes32"], [inner]));
    });

    const tree = new MerkleTree(leavesCorrect, ethers.keccak256, { sortPairs: true });
    return { tree, leaves: leavesCorrect };
}

describe("RewardDistributor", function () {
    async function deployFixture() {
        const [admin, recipient1, recipient2, recipient3, other] = await ethers.getSigners();

        const ACFactory = await ethers.getContractFactory("TerraQuraAccessControl");
        const accessControl = (await upgrades.deployProxy(ACFactory, [admin.address], {
            initializer: "initialize",
        })) as unknown as TerraQuraAccessControl;
        await accessControl.waitForDeployment();

        const RDFactory = await ethers.getContractFactory("RewardDistributor");
        const distributor = (await upgrades.deployProxy(
            RDFactory,
            [await accessControl.getAddress()],
            { initializer: "initialize" }
        )) as unknown as RewardDistributor;
        await distributor.waitForDeployment();

        return { distributor, accessControl, admin, recipient1, recipient2, recipient3, other };
    }

    const TEN_ETHER = ethers.parseEther("10");
    const ONE_ETHER = ethers.parseEther("1");

    // RewardType: Verification=0, Staking=1, Retirement=2, Referral=3, EarlyAdopter=4
    const VERIFICATION = 0;
    const STAKING = 1;

    describe("Create Campaign", function () {
        it("should create a campaign", async function () {
            const { distributor, admin } = await loadFixture(deployFixture);
            const now = await time.latest();
            const start = now + 100;
            const end = start + 86400;

            await expect(
                distributor.connect(admin).createCampaign("Test Campaign", TEN_ETHER, start, end, VERIFICATION, { value: TEN_ETHER })
            ).to.emit(distributor, "CampaignCreated");

            const campaign = await distributor.getCampaign(1);
            expect(campaign.name).to.equal("Test Campaign");
            expect(campaign.totalReward).to.equal(TEN_ETHER);
            expect(campaign.active).to.be.true;
        });

        it("should revert if start >= end", async function () {
            const { distributor, admin } = await loadFixture(deployFixture);
            const now = await time.latest();
            await expect(
                distributor.connect(admin).createCampaign("Test", TEN_ETHER, now + 200, now + 100, VERIFICATION, { value: TEN_ETHER })
            ).to.be.revertedWithCustomError(distributor, "InvalidTimePeriod");
        });

        it("should revert insufficient funding", async function () {
            const { distributor, admin } = await loadFixture(deployFixture);
            const now = await time.latest();
            await expect(
                distributor.connect(admin).createCampaign("Test", TEN_ETHER, now + 100, now + 200, VERIFICATION, { value: ONE_ETHER })
            ).to.be.revertedWithCustomError(distributor, "InsufficientFunding");
        });

        it("should revert zero total reward", async function () {
            const { distributor, admin } = await loadFixture(deployFixture);
            const now = await time.latest();
            await expect(
                distributor.connect(admin).createCampaign("Test", 0, now + 100, now + 200, VERIFICATION, { value: 0 })
            ).to.be.revertedWithCustomError(distributor, "ZeroAmount");
        });

        it("should revert non-admin creating campaign", async function () {
            const { distributor, other } = await loadFixture(deployFixture);
            const now = await time.latest();
            await expect(
                distributor.connect(other).createCampaign("Test", TEN_ETHER, now + 100, now + 200, VERIFICATION, { value: TEN_ETHER })
            ).to.be.revertedWithCustomError(distributor, "Unauthorized");
        });

        it("should refund excess funding", async function () {
            const { distributor, admin } = await loadFixture(deployFixture);
            const now = await time.latest();
            const excess = ethers.parseEther("15");

            const balBefore = await ethers.provider.getBalance(admin.address);
            const tx = await distributor.connect(admin).createCampaign("Test", TEN_ETHER, now + 100, now + 200, VERIFICATION, { value: excess });
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const balAfter = await ethers.provider.getBalance(admin.address);

            // Admin should have lost exactly TEN_ETHER + gas
            expect(balBefore - balAfter - gasCost).to.be.closeTo(TEN_ETHER, ethers.parseEther("0.001"));
        });
    });

    describe("Add Recipients", function () {
        async function campaignFixture() {
            const base = await deployFixture();
            const now = await time.latest();
            await base.distributor.connect(base.admin).createCampaign(
                "Test Campaign", TEN_ETHER, now + 10, now + 86410, VERIFICATION, { value: TEN_ETHER }
            );
            return base;
        }

        it("should add a single recipient", async function () {
            const { distributor, admin, recipient1 } = await loadFixture(campaignFixture);
            await expect(distributor.connect(admin).addRecipient(1, recipient1.address, 100))
                .to.emit(distributor, "RecipientAdded")
                .withArgs(1, recipient1.address, 100);

            expect(await distributor.recipientShares(1, recipient1.address)).to.equal(100);
        });

        it("should add batch recipients", async function () {
            const { distributor, admin, recipient1, recipient2, recipient3 } = await loadFixture(campaignFixture);
            await distributor.connect(admin).addRecipientBatch(
                1,
                [recipient1.address, recipient2.address, recipient3.address],
                [100, 200, 300]
            );

            const campaign = await distributor.getCampaign(1);
            expect(campaign.totalShares).to.equal(600);
        });

        it("should revert batch with length mismatch", async function () {
            const { distributor, admin, recipient1, recipient2 } = await loadFixture(campaignFixture);
            await expect(
                distributor.connect(admin).addRecipientBatch(1, [recipient1.address, recipient2.address], [100])
            ).to.be.revertedWithCustomError(distributor, "LengthMismatch");
        });

        it("should revert zero address recipient", async function () {
            const { distributor, admin } = await loadFixture(campaignFixture);
            await expect(
                distributor.connect(admin).addRecipient(1, ethers.ZeroAddress, 100)
            ).to.be.revertedWithCustomError(distributor, "ZeroAddress");
        });

        it("should revert zero share", async function () {
            const { distributor, admin, recipient1 } = await loadFixture(campaignFixture);
            await expect(
                distributor.connect(admin).addRecipient(1, recipient1.address, 0)
            ).to.be.revertedWithCustomError(distributor, "ZeroShare");
        });
    });

    describe("Claim Rewards", function () {
        async function claimableFixture() {
            const base = await deployFixture();
            const now = await time.latest();
            const start = now + 10;
            const end = start + 1000; // 1000 second campaign
            await base.distributor.connect(base.admin).createCampaign(
                "Test", TEN_ETHER, start, end, VERIFICATION, { value: TEN_ETHER }
            );
            await base.distributor.connect(base.admin).addRecipient(1, base.recipient1.address, 100);
            await base.distributor.connect(base.admin).addRecipient(1, base.recipient2.address, 100);
            return { ...base, start, end };
        }

        it("should return 0 claimable before campaign starts", async function () {
            const { distributor, recipient1 } = await loadFixture(claimableFixture);
            expect(await distributor.getClaimable(1, recipient1.address)).to.equal(0);
        });

        it("should vest linearly over campaign duration", async function () {
            const { distributor, recipient1, start } = await loadFixture(claimableFixture);
            // Advance to 50% through campaign
            await time.increaseTo(start + 500);

            // recipient1 has 100 out of 200 total shares = 50% of 10 ETH = 5 ETH
            // At 50% vesting = 2.5 ETH
            const claimable = await distributor.getClaimable(1, recipient1.address);
            expect(claimable).to.be.closeTo(ethers.parseEther("2.5"), ethers.parseEther("0.05"));
        });

        it("should allow full claim after campaign ends", async function () {
            const { distributor, recipient1, end } = await loadFixture(claimableFixture);
            await time.increaseTo(end + 1);

            const claimable = await distributor.getClaimable(1, recipient1.address);
            expect(claimable).to.equal(ethers.parseEther("5")); // 100/200 * 10 ETH
        });

        it("should claim and transfer AETH", async function () {
            const { distributor, recipient1, end } = await loadFixture(claimableFixture);
            await time.increaseTo(end + 1);

            const balBefore = await ethers.provider.getBalance(recipient1.address);
            const tx = await distributor.connect(recipient1).claim(1);
            const receipt = await tx.wait();
            const gasCost = receipt!.gasUsed * receipt!.gasPrice;
            const balAfter = await ethers.provider.getBalance(recipient1.address);

            expect(balAfter - balBefore + gasCost).to.equal(ethers.parseEther("5"));
        });

        it("should emit RewardClaimed event", async function () {
            const { distributor, recipient1, end } = await loadFixture(claimableFixture);
            await time.increaseTo(end + 1);

            await expect(distributor.connect(recipient1).claim(1))
                .to.emit(distributor, "RewardClaimed");
        });

        it("should revert if nothing to claim", async function () {
            const { distributor, other, start } = await loadFixture(claimableFixture);
            await time.increaseTo(start + 500);

            await expect(
                distributor.connect(other).claim(1)
            ).to.be.revertedWithCustomError(distributor, "NothingToClaim");
        });

        it("should allow incremental claiming (partial vest)", async function () {
            const { distributor, recipient1, start, end } = await loadFixture(claimableFixture);

            // Claim at 50%
            await time.increaseTo(start + 500);
            await distributor.connect(recipient1).claim(1);

            // Claim at 100%
            await time.increaseTo(end + 1);
            const claimable = await distributor.getClaimable(1, recipient1.address);
            expect(claimable).to.be.closeTo(ethers.parseEther("2.5"), ethers.parseEther("0.05"));
        });

        it("should return 0 for deactivated campaign", async function () {
            const { distributor, admin, recipient1, start } = await loadFixture(claimableFixture);
            await time.increaseTo(start + 500);
            await distributor.connect(admin).deactivateCampaign(1);

            expect(await distributor.getClaimable(1, recipient1.address)).to.equal(0);
        });
    });

    describe("Merkle Distribution", function () {
        it("should set merkle root", async function () {
            const { distributor, admin, recipient1, recipient2 } = await loadFixture(deployFixture);
            const now = await time.latest();
            await distributor.connect(admin).createCampaign(
                "Airdrop", TEN_ETHER, now + 10, now + 86410, STAKING, { value: TEN_ETHER }
            );

            const entries = [
                { address: recipient1.address, amount: ethers.parseEther("3") },
                { address: recipient2.address, amount: ethers.parseEther("7") },
            ];
            const { tree } = buildMerkleTree(entries);

            await expect(
                distributor.connect(admin).setMerkleRoot(1, tree.getHexRoot())
            ).to.emit(distributor, "MerkleRootSet");
        });

        it("should allow valid merkle claim", async function () {
            const { distributor, admin, recipient1, recipient2 } = await loadFixture(deployFixture);
            const now = await time.latest();
            await distributor.connect(admin).createCampaign(
                "Airdrop", TEN_ETHER, now + 10, now + 86410, STAKING, { value: TEN_ETHER }
            );

            const amount1 = ethers.parseEther("3");
            const amount2 = ethers.parseEther("7");

            const entries = [
                { address: recipient1.address, amount: amount1 },
                { address: recipient2.address, amount: amount2 },
            ];
            const { tree, leaves } = buildMerkleTree(entries);
            await distributor.connect(admin).setMerkleRoot(1, tree.getHexRoot());

            await time.increaseTo(now + 11);

            const proof = tree.getHexProof(leaves[0]);

            await expect(
                distributor.connect(recipient1).claimMerkle(1, amount1, proof)
            ).to.emit(distributor, "RewardClaimed")
                .withArgs(1, recipient1.address, amount1);
        });

        it("should reject invalid merkle proof", async function () {
            const { distributor, admin, recipient1, other } = await loadFixture(deployFixture);
            const now = await time.latest();
            await distributor.connect(admin).createCampaign(
                "Airdrop", TEN_ETHER, now + 10, now + 86410, STAKING, { value: TEN_ETHER }
            );

            const entries = [
                { address: recipient1.address, amount: ethers.parseEther("3") },
            ];
            const { tree, leaves } = buildMerkleTree(entries);
            await distributor.connect(admin).setMerkleRoot(1, tree.getHexRoot());
            await time.increaseTo(now + 11);

            const proof = tree.getHexProof(leaves[0]);

            // other tries to claim with recipient1's proof
            await expect(
                distributor.connect(other).claimMerkle(1, ethers.parseEther("3"), proof)
            ).to.be.revertedWithCustomError(distributor, "InvalidProof");
        });

        it("should reject double merkle claim", async function () {
            const { distributor, admin, recipient1 } = await loadFixture(deployFixture);
            const now = await time.latest();
            await distributor.connect(admin).createCampaign(
                "Airdrop", TEN_ETHER, now + 10, now + 86410, STAKING, { value: TEN_ETHER }
            );

            const amount1 = ethers.parseEther("3");
            const entries = [{ address: recipient1.address, amount: amount1 }];
            const { tree, leaves } = buildMerkleTree(entries);
            await distributor.connect(admin).setMerkleRoot(1, tree.getHexRoot());
            await time.increaseTo(now + 11);

            const proof = tree.getHexProof(leaves[0]);
            await distributor.connect(recipient1).claimMerkle(1, amount1, proof);

            await expect(
                distributor.connect(recipient1).claimMerkle(1, amount1, proof)
            ).to.be.revertedWithCustomError(distributor, "AlreadyClaimed");
        });

        it("should revert merkle claim when root not set", async function () {
            const { distributor, admin, recipient1 } = await loadFixture(deployFixture);
            const now = await time.latest();
            await distributor.connect(admin).createCampaign(
                "Airdrop", TEN_ETHER, now + 10, now + 86410, STAKING, { value: TEN_ETHER }
            );
            await time.increaseTo(now + 11);

            await expect(
                distributor.connect(recipient1).claimMerkle(1, ONE_ETHER, [])
            ).to.be.revertedWithCustomError(distributor, "MerkleRootNotSet");
        });
    });
});
