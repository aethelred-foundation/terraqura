import { ethers, network } from "hardhat";

/**
 * TerraQura seal-anchored Proof-of-Physics E2E — the consensus-anchored MRV
 * claim, live.
 *
 * Proves the MRV flow no oracle-multisig carbon registry can offer: a capture
 * claim admitted only when a Digital Seal minted by the chain's own
 * attested-compute (PoUW) pipeline exists, is ACTIVE, is bound to THIS exact
 * (dacUnitId, sourceDataHash) claim, and satisfies the CEAP policy — all
 * checked by consensus logic via the ISeal precompile (0x0900):
 *
 *   1. deploy SealProofOfPhysics(governance) (or reuse REGISTRY_ADDRESS)
 *   2. governance sets the CEAP policy (tee backend, AE residency)
 *   3. isAnchored(dacUnitId, sourceDataHash) === false — no seal yet
 *   4. a PoUW MRV job runs on-chain with purpose
 *      `terraqura:0x<dacUnitId>:0x<sourceDataHash>` → validators verify →
 *      quorum mints the Digital Seal (driven by the operator via the
 *      aethelredd CLI; this script prints the exact command, using the
 *      contract's own expectedPurpose())
 *   5. anchor(dacUnitId, sourceDataHash, JOB_ID) verifies the seal via ISeal
 *      and records the anchor; isAnchored flips true
 *
 * This is an operator playbook: it automates every EVM-side step and, when the
 * PoUW seal is ready, pass its JOB_ID to complete anchoring. Without JOB_ID it
 * stops after proving no-seal-no-anchor and printing the mint command.
 *
 * The definitive seal-binding proof (real ISeal precompile + real seal keeper +
 * this exact bytecode, incl. live revocation) lives in the aethelred repo at
 * internal/evmhost/terraqura_test.go — this script is the live-node
 * counterpart.
 *
 * Run (local aethelredd devnet reachable as the testnet network):
 *   AETHELRED_TESTNET_RPC_URL=http://127.0.0.1:8545 \
 *   AETHELRED_TESTNET_PRIVATE_KEY=<funded-key> \
 *   [REGISTRY_ADDRESS=0x…] [JOB_ID=<sealed-job>] \
 *   npx hardhat run scripts/devnet-seal-proof-of-physics-e2e.ts --network aethelredTestnet
 */

const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS ?? "";
const JOB_ID = process.env.JOB_ID ?? "";

const DAC_UNIT_ID = ethers.keccak256(ethers.toUtf8Bytes(process.env.DAC_UNIT ?? "DAC_UNIT_001"));
const SOURCE_DATA_HASH = ethers.keccak256(
    ethers.toUtf8Bytes(process.env.SENSOR_BATCH ?? "sensor_data_batch_001"),
);

function step(msg: string): void {
    console.log(`\n== ${msg}`);
}

function fail(msg: string): never {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
}

async function main(): Promise<void> {
    step("chain identity");
    const { chainId } = await ethers.provider.getNetwork();
    if (chainId !== 7332n) fail(`chain id ${chainId}, want 7332 (network: ${network.name})`);
    const [governance] = await ethers.getSigners();
    console.log(`eth_chainId: ${chainId}`);
    console.log(`governance:  ${governance.address}`);
    console.log(`dacUnitId:   ${DAC_UNIT_ID}`);
    console.log(`sourceData:  ${SOURCE_DATA_HASH}`);

    const Registry = await ethers.getContractFactory("SealProofOfPhysics");
    let registry;
    if (REGISTRY_ADDRESS) {
        registry = Registry.attach(REGISTRY_ADDRESS) as Awaited<ReturnType<typeof Registry.deploy>>;
        console.log(`\nusing REGISTRY_ADDRESS ${REGISTRY_ADDRESS}`);
    } else {
        step("deploy SealProofOfPhysics(governance)");
        registry = await Registry.deploy(governance.address);
        await registry.waitForDeployment();
        console.log(`deployed at ${await registry.getAddress()}`);
    }

    step("governance: set CEAP policy (tee backend, AE residency)");
    await (await registry.setCompliancePolicy(["tee"], "", [], false, ["AE"])).wait();
    const policy = await registry.compliancePolicy();
    console.log(`policy read-back: backends=${JSON.stringify(policy[0])} residency=${JSON.stringify(policy[4])}`);

    step("no seal yet: isAnchored must be false");
    if (await registry.isAnchored(DAC_UNIT_ID, SOURCE_DATA_HASH)) {
        fail("claim anchored before any seal — gate is not closed");
    }
    console.log("isAnchored = false (no consensus anchor) ✓");

    // The contract itself is the source of truth for the required purpose.
    const expected = await registry.expectedPurpose(DAC_UNIT_ID, SOURCE_DATA_HASH);

    if (!JOB_ID) {
        step("mint the backing seal (operator step)");
        console.log("Run a PoUW MRV job whose purpose binds this exact claim, then re-run");
        console.log("with JOB_ID set:\n");
        console.log(
            `  aethelredd tx pouw register-model --model terraqura-mrv-v1 --model-id terraqura-mrv \\\n` +
                `    --from validator --chain-id <id> --keyring-backend test --yes`,
        );
        console.log(
            `  aethelredd tx pouw submit-job --model terraqura-mrv-v1 --input mrv-${DAC_UNIT_ID.slice(2, 10)} \\\n` +
                `    --proof-type tee --purpose "${expected}" \\\n` +
                `    --conf-backends tee --conf-residency AE \\\n` +
                `    --from validator --chain-id <id> --keyring-backend test --yes`,
        );
        console.log(
            `\nWait for the quorum-minted seal, then:\n  JOB_ID=<job-id> REGISTRY_ADDRESS=${await registry.getAddress()} \\\n` +
                `    npx hardhat run scripts/devnet-seal-proof-of-physics-e2e.ts --network aethelredTestnet`,
        );
        console.log("\nGATE PROVEN CLOSED. Provide JOB_ID to complete consensus-anchored MRV.");
        return;
    }

    step(`anchor(dacUnitId, sourceDataHash, ${JOB_ID}) — verify seal via ISeal + record anchor`);
    await (await registry.anchor(DAC_UNIT_ID, SOURCE_DATA_HASH, JOB_ID)).wait();
    if (!(await registry.isAnchored(DAC_UNIT_ID, SOURCE_DATA_HASH))) {
        fail("claim not anchored after anchor()");
    }
    console.log("isAnchored = true (anchored to Digital Seal) ✓");

    step("requireAnchored must not revert for the anchored claim");
    await registry.requireAnchored(DAC_UNIT_ID, SOURCE_DATA_HASH);
    console.log("requireAnchored passed ✓");

    console.log(
        "\nCONSENSUS-ANCHORED MRV LIVE: no seal → no anchor; quorum-minted, " +
            "claim-bound, policy-satisfying seal → anchor. Revoke the seal on-chain " +
            "and isAnchored flips false with no TerraQura tx.",
    );
}

main().catch((e) => {
    fail(e instanceof Error ? e.message : String(e));
});
