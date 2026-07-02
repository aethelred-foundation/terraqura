import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const env = process.env;

const requiredContractKeys = [
  "accessControl",
  "verificationEngine",
  "carbonCredit",
  "carbonMarketplace",
  "gaslessMarketplace",
  "multisig",
  "timelock",
  "circuitBreaker",
  "nativeIoTOracle",
];

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function hasFlag(name) {
  return args.includes(name);
}

function readJson(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

function gitValue(gitArgs, fallback) {
  const result = spawnSync("git", gitArgs, {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return fallback;
  }
  return result.stdout.trim() || fallback;
}

const outputPath = resolve(
  root,
  argValue("--output") ?? "output/evidence/terraqura-production-evidence-pack.md",
);
const deploymentKey =
  argValue("--deployment") ??
  env.TERRAQURA_DEPLOYMENT ??
  env.NEXT_PUBLIC_TERRAQURA_DEPLOYMENT ??
  "aethelredMainnetPending";
const force = hasFlag("--force");

const manifest = readJson("packages/network-manifest/manifest.json");
const deployment = manifest.deployments?.[deploymentKey];
if (!deployment) {
  console.error(`Deployment "${deploymentKey}" was not found in packages/network-manifest/manifest.json.`);
  process.exit(1);
}

const network = manifest.networks?.[deployment.network];
if (!network) {
  console.error(`Deployment "${deploymentKey}" references unknown network "${deployment.network}".`);
  process.exit(1);
}

if (existsSync(outputPath) && !force) {
  console.error(
    `Evidence pack already exists at ${outputPath}. Re-run with --force to overwrite it.`,
  );
  process.exit(1);
}

const generatedAt = new Date().toISOString();
const branch = gitValue(["branch", "--show-current"], "unknown");
const commit = gitValue(["rev-parse", "HEAD"], "unknown");
const shortStatus = gitValue(["status", "--porcelain"], "not inspected");
const worktreeState = shortStatus.length === 0 ? "clean" : "dirty";

const contractRows = requiredContractKeys
  .map((contractKey) => {
    const address = deployment.contracts?.[contractKey] ?? "missing";
    return `| ${contractKey} | ${address} |`;
  })
  .join("\n");

const evidencePack = `# TerraQura Production Evidence Pack

Prepared on: ${generatedAt}
Prepared by: pending release owner
Release branch: ${branch}
Release commit: ${commit}
Network key: ${deployment.network}
Deployment key: ${deploymentKey}
Decision: NO-GO
Open critical exceptions: generated scaffold requires live command evidence, approver sign-off, and drill artifacts before launch.
Rollback owner: pending operations owner

## Approvals

- Product: pending
- Engineering: pending
- Security: pending
- Compliance: pending
- Operations: pending

## Validation Commands

| Command | Timestamp | Exit Code | Output |
| --- | --- | --- | --- |
| pnpm validate:network | pending | pending | pending |
| pnpm validate:enterprise | pending | pending | pending |
| pnpm validate:production-artifacts | pending | pending | pending |
| pnpm validate:production-launch | pending | pending | pending |
| pnpm test:api-golden | pending | pending | pending |
| pnpm test:database-domain | pending | pending | pending |
| pnpm test:security-sim | pending | pending | pending |

## Deployment Manifest

- TERRAQURA_DEPLOYMENT=${deploymentKey}
- TERRAQURA_NETWORK=${deployment.network}
- Manifest source: packages/network-manifest/manifest.json
- Network display name: ${network.displayName}
- Chain ID: ${network.chainId}
- Network role: ${network.role}
- Deployment status: ${deployment.status}
- Deployment source: ${deployment.source}
- Deployment version: ${deployment.version}
- Worktree state at scaffold creation: ${worktreeState}

| Contract | Address |
| --- | --- |
${contractRows}

## Golden Workflow Drill

Canonical path: operator onboarding -> telemetry ingestion -> verification -> minting -> retirement -> audit export

- tenant.created: pending event id
- telemetry.window_opened: pending event id
- verification_batch.verified: pending event id
- carbon_credit.minted: pending transaction receipt
- carbon_credit.retired: pending transaction receipt
- audit_export.generated: pending export reference

Required drill evidence:

- operator onboarding artifact: pending
- telemetry ingestion artifact: pending
- verification artifact: pending
- mint transaction artifact: pending
- retirement artifact: pending
- audit lineage export artifact: pending

## Health Checks

- API /v1/health: pending
- API /v1/health/ready: pending
- worker: pending
- verifier: pending
- indexer: pending
- analytics service: pending
- Postgres: pending
- Redis: pending
- selected RPC provider: pending
- contract-event monitor: pending
- web dashboard smoke route: pending

## Audit Lineage

- getCarbonRemovalAuditLineage output: pending
- payload hashes by default: pending
- raw payload inclusion approval: not requested

## Security Scope

- external audit status: pending
- contracts in scope: pending
- relayer and gasless flow scope: pending
- verifier and worker scope: pending
- key-management model: pending
- open findings: pending
- resolved findings: pending
- accepted risks: pending
- incident response owner: pending
- circuit breaker runbook link: pending

## Operational Evidence

- service owners and SLO links: pending
- Alertmanager routing proof: pending
- Prometheus alert rule version: pending
- runbook links: pending
- backup/restore drill note: pending
- RPC degradation drill: pending
- Redis interruption drill: pending
- delayed verifier response drill: pending
- failed webhook delivery drill: pending
- stale indexer data drill: pending
- queue backlog drill: pending
- rollback owner: pending operations owner

## Live vs Preview Evidence

- NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=pending
- launch-critical surface inventory: pending
- buyer views live-backed: pending
- operator views live-backed: pending
- sovereign views live-backed: pending
- minting views live-backed: pending
- retirement views live-backed: pending
- compliance views live-backed: pending
- remaining preview surfaces outside launch-critical workflow: pending

## Secrets and Environment Isolation

- environment name: pending
- secret owner roles: pending
- secret rotation cadence: pending
- relayer key custody model: pending
- KYC provider mode: pending
- webhook secret rotation plan: pending
- PagerDuty and Slack secret mounting strategy: pending
- No production secrets committed: no

## Exceptions and Rollback

- Open critical exceptions: generated scaffold requires live command evidence, approver sign-off, and drill artifacts before launch.
- Open high exceptions: pending review
- Open medium exceptions: pending review
- Rollback procedure: pending
- Rollback owner: pending operations owner
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, evidencePack);

console.log(`Wrote production evidence pack scaffold to ${outputPath}`);
console.log("The scaffold is intentionally NO-GO until real launch evidence is filled in.");
