import { expect } from "chai";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifacts, ethers, upgrades } from "hardhat";

import {
  assertCheckpointCompatible,
  CandidateConfiguration,
  configurationDigest,
  createCheckpoint,
  readCheckpoint,
  writeCheckpoint,
} from "../scripts/lib/deployment-checkpoint";

const configuration: CandidateConfiguration = {
  network: "aethelredTestnet",
  chainId: 7332,
  sourceCommit: "a".repeat(40),
  deployer: "0x1111111111111111111111111111111111111111",
  protocolOwner: "0x2222222222222222222222222222222222222222",
  feeRecipient: "0x3333333333333333333333333333333333333333",
  operatorSigner: "0x4444444444444444444444444444444444444444",
  metadataBaseUri: "https://metadata.example.test/terraqura",
  platformFeeBps: 250,
};

const candidateArtifacts = {
  accessControl: "TerraQuraAccessControl",
  circuitBreaker: "CircuitBreaker",
  verificationEngine: "VerificationEngine",
  carbonCredit: "CarbonCredit",
  carbonMarketplace: "CarbonMarketplace",
} as const;

describe("deployment checkpoint", function () {
  it("has a stable configuration digest independent of object key order", function () {
    const reordered = Object.fromEntries(
      Object.entries(configuration).reverse(),
    ) as unknown as CandidateConfiguration;

    expect(configurationDigest(reordered)).to.equal(
      configurationDigest(configuration),
    );
  });

  it("writes and reads a secret-free, mode-restricted checkpoint", function () {
    const directory = mkdtempSync(join(tmpdir(), "terraqura-checkpoint-"));
    const path = join(directory, "checkpoint.json");
    const checkpoint = createCheckpoint(
      configuration,
      candidateArtifacts,
      "2026-07-30T00:00:00.000Z",
    );

    writeCheckpoint(path, checkpoint, "2026-07-30T00:01:00.000Z");
    const restored = readCheckpoint(path);

    expect(restored).to.deep.equal(checkpoint);
    expect(readFileSync(path, "utf8")).not.to.include("PRIVATE_KEY");
  });

  it("rejects a checkpoint when any immutable input changes", function () {
    const checkpoint = createCheckpoint(configuration, candidateArtifacts);
    const changed = {
      ...configuration,
      platformFeeBps: 251,
    };

    expect(() => assertCheckpointCompatible(checkpoint, changed)).to.throw(
      "Checkpoint configuration does not match",
    );
  });

  it("deploys a validated implementation and ERC-1967 proxy without a proxy admin", async function () {
    const [deployer] = await ethers.getSigners();
    const implementationFactory = await ethers.getContractFactory(
      "TerraQuraAccessControl",
    );
    await upgrades.validateImplementation(implementationFactory, {
      kind: "uups",
    });
    const implementation = await implementationFactory.deploy();
    await implementation.waitForDeployment();

    const initializerData = implementationFactory.interface.encodeFunctionData(
      "initialize",
      [deployer.address],
    );
    const proxyFactory = await ethers.getContractFactory("ERC1967Proxy");
    const proxy = await proxyFactory.deploy(
      await implementation.getAddress(),
      initializerData,
    );
    await proxy.waitForDeployment();

    const accessControl = await ethers.getContractAt(
      "TerraQuraAccessControl",
      await proxy.getAddress(),
    );
    expect(
      await accessControl.hasRole(
        await accessControl.DEFAULT_ADMIN_ROLE(),
        deployer.address,
      ),
    ).to.equal(true);
    expect(
      await upgrades.erc1967.getImplementationAddress(await proxy.getAddress()),
    ).to.equal(await implementation.getAddress());

    const proxyArtifact = await artifacts.readArtifact("ERC1967Proxy");
    expect(
      ethers.keccak256(await ethers.provider.getCode(await proxy.getAddress())),
    ).to.equal(ethers.keccak256(proxyArtifact.deployedBytecode));
  });
});
