import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();
const node = process.execPath;

function runNode(args, env = {}) {
  return spawnSync(node, args, {
    cwd: root,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
}

function runGate(args = [], env = {}) {
  return runNode(["scripts/production-launch-gate.mjs", ...args], env);
}

function outputOf(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function loadManifest() {
  return JSON.parse(
    readFileSync(join(root, "packages/network-manifest/manifest.json"), "utf8"),
  );
}

test("artifact-only production launch gate validates static artifacts", () => {
  const result = runGate(["--artifacts-only"]);
  assert.equal(outputOf(result).includes("TerraQura production launch artifacts are present."), true);
  assert.equal(result.status, 0);
});

test("generated evidence scaffold is rejected as an unapproved launch pack", () => {
  const dir = mkdtempSync(join(tmpdir(), "terraqura-evidence-"));
  const packPath = join(dir, "pack.md");
  const generateResult = runNode([
    "scripts/create-production-evidence-pack.mjs",
    "--output",
    packPath,
    "--force",
  ]);
  assert.equal(generateResult.status, 0, outputOf(generateResult));

  const result = runGate([], {
    TERRAQURA_LAUNCH_PROFILE: "golden-workflow",
    NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE: "live",
    TERRAQURA_DEPLOYMENT: "aethelredMainnetPending",
    TERRAQURA_PRODUCTION_EVIDENCE_PACK: packPath,
  });
  const output = outputOf(result);

  assert.notEqual(result.status, 0);
  assert.match(output, /Decision: GO/);
  assert.match(output, /Open critical exceptions: none/);
  assert.match(output, /No production secrets committed: yes/);
});

test("finalized evidence content passes evidence checks before deployment gates fail", () => {
  const manifest = loadManifest();
  const deploymentKey = "polygonAmoyV3Final";
  const deployment = manifest.deployments[deploymentKey];
  const network = manifest.networks[deployment.network];
  const dir = mkdtempSync(join(tmpdir(), "terraqura-evidence-"));
  const packPath = join(dir, "finalized-pack.md");
  const contractRows = Object.entries(deployment.contracts)
    .map(([contract, address]) => `| ${contract} | ${address} |`)
    .join("\n");

  writeFileSync(
    packPath,
    `# TerraQura Production Evidence Pack

Prepared on: 2026-06-27T00:00:00.000Z
Prepared by: release owner
Release branch: codex/test
Release commit: abcdef1234567890
Network key: ${deployment.network}
Deployment key: ${deploymentKey}
Decision: GO
Open critical exceptions: none
Rollback owner: operations owner

## Approvals

- Product: approved
- Engineering: approved
- Security: approved
- Compliance: approved
- Operations: approved

## Validation Commands

| Command | Timestamp | Exit Code | Output |
| --- | --- | --- | --- |
| pnpm validate:network | 2026-06-27T00:00:00.000Z | 0 | saved |
| pnpm validate:enterprise | 2026-06-27T00:00:00.000Z | 0 | saved |
| pnpm validate:production-launch | 2026-06-27T00:00:00.000Z | 0 | saved |
| pnpm test:api-golden | 2026-06-27T00:00:00.000Z | 0 | saved |
| pnpm test:database-domain | 2026-06-27T00:00:00.000Z | 0 | saved |
| pnpm test:security-sim | 2026-06-27T00:00:00.000Z | 0 | saved |

## Deployment Manifest

- TERRAQURA_DEPLOYMENT=${deploymentKey}
- TERRAQURA_NETWORK=${deployment.network}
- Network display name: ${network.displayName}
- Chain ID: ${network.chainId}

| Contract | Address |
| --- | --- |
${contractRows}

## Golden Workflow Drill

operator onboarding -> telemetry ingestion -> verification -> minting -> retirement -> audit export

- tenant.created: event-1
- telemetry.window_opened: event-2
- verification_batch.verified: event-3
- carbon_credit.minted: tx-1
- carbon_credit.retired: tx-2
- audit_export.generated: export-1

## Health Checks

- API /v1/health: live
- API /v1/health/ready: live
- worker: live
- verifier: live
- indexer: live
- analytics service: live
- Postgres: live
- Redis: live
- selected RPC provider: live

## Audit Lineage

- getCarbonRemovalAuditLineage output: attached
- payload hashes by default: yes

## Security Scope

- external audit status: approved for release
- contracts in scope: listed
- relayer and gasless flow scope: listed

## Operational Evidence

- Alertmanager routing proof: attached
- runbook links: attached
- rollback owner: operations owner

## Live vs Preview Evidence

- NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=live
- launch-critical surface inventory: approved

## Secrets and Environment Isolation

- No production secrets committed: yes

## Exceptions and Rollback

- Open critical exceptions: none
- Rollback owner: operations owner
`,
  );

  const result = runGate([], {
    TERRAQURA_LAUNCH_PROFILE: "golden-workflow",
    NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE: "live",
    TERRAQURA_DEPLOYMENT: deploymentKey,
    TERRAQURA_PRODUCTION_EVIDENCE_PACK: packPath,
    TERRAQURA_ALLOW_DIRTY_RELEASE: "true",
    TERRAQURA_RELEASE_ARTIFACT_POLICY_ACK: "true",
  });
  const output = outputOf(result);

  assert.notEqual(result.status, 0);
  assert.match(output, /not a production primary-target network/);
  assert.match(output, /nativeIoTOracle/);
  assert.doesNotMatch(output, /Production evidence pack/);
});
