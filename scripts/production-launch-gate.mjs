import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const artifactsOnly = args.has("--artifacts-only");
const errors = [];
const warnings = [];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
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

const requiredArtifacts = [
  "docs/platform/CONSULTANT_HARDENING_REGISTER.md",
  "docs/platform/GOLDEN_WORKFLOW_STATE_MACHINE.md",
  "docs/platform/DASHBOARD_DATA_PROVENANCE_INVENTORY.md",
  "docs/platform/PRODUCTION_EVIDENCE_PACK.md",
  "docs/platform/GOLDEN_WORKFLOWS.md",
  "docs/platform/NETWORK_DEPLOYMENT_MANIFEST.md",
  "docs/platform/ENTERPRISE_READINESS.md",
  "docs/compliance/DATA_GOVERNANCE_AND_AUDIT_EXPORT.md",
  "docs/operations/SERVICE_OWNERSHIP_AND_SLOS.md",
  "docs/operations/ALERT_RUNBOOKS.md",
  "docs/security/EXPLOIT_SIMULATION_MATRIX.md",
  "packages/network-manifest/manifest.json",
];

const requiredArtifactTerms = {
  "docs/platform/CONSULTANT_HARDENING_REGISTER.md": [
    "Critical Priority",
    "High Priority",
    "Medium Priority",
    "production launch gate",
  ],
  "docs/platform/GOLDEN_WORKFLOW_STATE_MACHINE.md": [
    "operator onboarding -> telemetry ingestion -> verification -> minting -> retirement -> audit export",
    "Approval Boundary",
    "Domain Event",
    "Replay Safety",
  ],
  "docs/platform/DASHBOARD_DATA_PROVENANCE_INVENTORY.md": [
    "Live",
    "Preview",
    "Mixed",
    "No critical buyer, operator, sovereign, minting, retirement, or compliance view may depend on preview data in production.",
  ],
  "docs/platform/PRODUCTION_EVIDENCE_PACK.md": [
    "Go/No-Go",
    "Deployment Manifest",
    "Golden Workflow Drill",
    "Health Checks",
    "Audit Lineage",
  ],
};

const requiredEvidencePackHeadings = [
  "Approvals",
  "Validation Commands",
  "Deployment Manifest",
  "Golden Workflow Drill",
  "Health Checks",
  "Audit Lineage",
  "Security Scope",
  "Operational Evidence",
  "Live vs Preview Evidence",
  "Secrets and Environment Isolation",
  "Exceptions and Rollback",
];

const requiredEvidencePackTerms = [
  "pnpm validate:network",
  "pnpm validate:enterprise",
  "pnpm validate:production-launch",
  "pnpm test:api-golden",
  "pnpm test:database-domain",
  "pnpm test:security-sim",
  "operator onboarding -> telemetry ingestion -> verification -> minting -> retirement -> audit export",
  "tenant.created",
  "telemetry.window_opened",
  "verification_batch.verified",
  "carbon_credit.minted",
  "carbon_credit.retired",
  "audit_export.generated",
  "API /v1/health",
  "API /v1/health/ready",
  "worker",
  "verifier",
  "indexer",
  "analytics service",
  "Postgres",
  "Redis",
  "selected RPC provider",
  "external audit status",
  "Alertmanager",
  "rollback owner",
  "No production secrets committed: yes",
];

const forbiddenEvidencePackPatterns = [
  {
    pattern: /^Decision:\s*GO\s*\/\s*NO-GO\s*$/im,
    message: "template go/no-go placeholder is still present",
  },
  {
    pattern: /^Decision:\s*NO-GO\s*$/im,
    message: "go/no-go decision has not been approved",
  },
  {
    pattern: /\b(?:TODO|TBD)\b/i,
    message: "placeholder TODO/TBD text is still present",
  },
  {
    pattern: /\|\s*pnpm validate:network\s*\|\s*\|\s*\|\s*\|/i,
    message: "validation command table still contains empty template cells",
  },
];

function readText(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recordMissingArtifact(relPath) {
  errors.push(`Required launch artifact is missing: ${relPath}`);
}

for (const relPath of requiredArtifacts) {
  if (!existsSync(join(root, relPath))) {
    recordMissingArtifact(relPath);
  }
}

for (const [relPath, requiredTerms] of Object.entries(requiredArtifactTerms)) {
  if (!existsSync(join(root, relPath))) {
    continue;
  }

  const text = readText(relPath);
  for (const term of requiredTerms) {
    if (!text.includes(term)) {
      errors.push(`${relPath}: missing required launch-control term "${term}"`);
    }
  }
}

if (artifactsOnly) {
  finish();
  process.exit(0);
}

const env = process.env;
const launchProfile = env.TERRAQURA_LAUNCH_PROFILE;
if (launchProfile !== "golden-workflow") {
  errors.push(
    "TERRAQURA_LAUNCH_PROFILE must be set to golden-workflow for production launch.",
  );
}

const dashboardMode =
  env.NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE ??
  env.TERRAQURA_DASHBOARD_DATA_MODE;
if (dashboardMode !== "live") {
  errors.push(
    "NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE must be live before production launch.",
  );
}

const deploymentKey =
  env.TERRAQURA_DEPLOYMENT ?? env.NEXT_PUBLIC_TERRAQURA_DEPLOYMENT;
if (!deploymentKey) {
  errors.push("TERRAQURA_DEPLOYMENT must explicitly name the launch deployment.");
}

let manifest = null;
let selectedDeployment = null;
let selectedNetwork = null;
try {
  manifest = JSON.parse(readText("packages/network-manifest/manifest.json"));
} catch (error) {
  errors.push(`Unable to parse packages/network-manifest/manifest.json: ${String(error)}`);
}

if (manifest && deploymentKey) {
  const deployment = manifest.deployments?.[deploymentKey];
  if (!deployment) {
    errors.push(`Deployment "${deploymentKey}" is not present in the network manifest.`);
  } else {
    selectedDeployment = deployment;
    const network = manifest.networks?.[deployment.network];
    if (!network) {
      errors.push(
        `Deployment "${deploymentKey}" references unknown network "${deployment.network}".`,
      );
    } else {
      selectedNetwork = network;
      if (network.role !== "primary-target") {
        errors.push(
          `Deployment "${deploymentKey}" targets ${network.displayName}, which is not a production primary-target network.`,
        );
      }
    }

    if (deployment.status === "pending-deployment") {
      errors.push(
        `Deployment "${deploymentKey}" is still pending; production launch requires a checked-in deployed manifest.`,
      );
    }

    for (const contractKey of requiredContractKeys) {
      const address = deployment.contracts?.[contractKey];
      if (!address || address.toLowerCase() === ZERO_ADDRESS) {
        errors.push(
          `Deployment "${deploymentKey}" is missing nonzero ${contractKey} address.`,
        );
      }
    }
  }
}

const evidencePackPath = resolve(
  root,
  env.TERRAQURA_PRODUCTION_EVIDENCE_PACK ??
    "output/evidence/terraqura-production-evidence-pack.md",
);
if (!existsSync(evidencePackPath)) {
  errors.push(
    `Production evidence pack is missing at ${evidencePackPath}. Set TERRAQURA_PRODUCTION_EVIDENCE_PACK or create the default pack.`,
  );
} else if (!statSync(evidencePackPath).isFile()) {
  errors.push(`Production evidence pack path is not a file: ${evidencePackPath}`);
} else {
  validateProductionEvidencePack(evidencePackPath);
}

if (env.TERRAQURA_ALLOW_DIRTY_RELEASE !== "true") {
  const gitStatus = spawnSync(
    "git",
    [
      "status",
      "--porcelain",
      "--untracked-files=normal",
      "--",
      ".",
      ":(exclude).claude",
    ],
    {
      cwd: root,
      encoding: "utf8",
    },
  );

  if (gitStatus.status !== 0) {
    errors.push(`Unable to inspect release cleanliness with git status: ${gitStatus.stderr}`);
  } else if (gitStatus.stdout.trim().length > 0) {
    errors.push(
      "Release worktree is dirty. Commit or remove changes before production launch, or set TERRAQURA_ALLOW_DIRTY_RELEASE=true only for a documented emergency drill.",
    );
  }
} else {
  warnings.push(
    "TERRAQURA_ALLOW_DIRTY_RELEASE=true bypassed the clean release-candidate check.",
  );
}

if (existsSync(join(root, "latest-version")) || existsSync(join(root, "new-version"))) {
  if (env.TERRAQURA_RELEASE_ARTIFACT_POLICY_ACK !== "true") {
    errors.push(
      "Generated/static archive outputs are present. Set TERRAQURA_RELEASE_ARTIFACT_POLICY_ACK=true only after the release manifest excludes non-production archive outputs.",
    );
  }
}

finish();

function validateProductionEvidencePack(filePath) {
  const evidenceText = readFileSync(filePath, "utf8");

  if (!/^Decision:\s*GO\s*$/im.test(evidenceText)) {
    errors.push('Production evidence pack must contain an approved "Decision: GO" line.');
  }

  if (!/^Open critical exceptions:\s*none\s*$/im.test(evidenceText)) {
    errors.push(
      'Production evidence pack must contain "Open critical exceptions: none".',
    );
  }

  if (!/^Release commit:\s*[0-9a-f]{7,40}\s*$/im.test(evidenceText)) {
    errors.push(
      "Production evidence pack must record a concrete 7-40 character git release commit.",
    );
  }

  if (!/NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE\s*=\s*live/i.test(evidenceText)) {
    errors.push(
      "Production evidence pack must prove NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=live.",
    );
  }

  for (const heading of requiredEvidencePackHeadings) {
    const headingPattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "m");
    if (!headingPattern.test(evidenceText)) {
      errors.push(`Production evidence pack is missing required section: ${heading}`);
    }
  }

  for (const requiredTerm of requiredEvidencePackTerms) {
    if (!evidenceText.includes(requiredTerm)) {
      errors.push(
        `Production evidence pack is missing required evidence term "${requiredTerm}".`,
      );
    }
  }

  for (const { pattern, message } of forbiddenEvidencePackPatterns) {
    if (pattern.test(evidenceText)) {
      errors.push(`Production evidence pack is not finalized: ${message}.`);
    }
  }

  if (deploymentKey && !evidenceText.includes(deploymentKey)) {
    errors.push(
      `Production evidence pack does not reference selected deployment ${deploymentKey}.`,
    );
  }

  if (selectedDeployment?.network && !evidenceText.includes(selectedDeployment.network)) {
    errors.push(
      `Production evidence pack does not reference selected network ${selectedDeployment.network}.`,
    );
  }

  if (selectedNetwork?.chainId && !evidenceText.includes(String(selectedNetwork.chainId))) {
    errors.push(
      `Production evidence pack does not reference selected chain id ${selectedNetwork.chainId}.`,
    );
  }

  if (selectedDeployment?.contracts) {
    for (const contractKey of requiredContractKeys) {
      const address = selectedDeployment.contracts[contractKey];
      if (address && address.toLowerCase() !== ZERO_ADDRESS && !evidenceText.includes(address)) {
        errors.push(
          `Production evidence pack does not include ${contractKey} address ${address}.`,
        );
      }
    }
  }
}

function finish() {
  if (errors.length > 0) {
    console.error("TerraQura production launch gate failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    for (const warning of warnings) {
      console.error(`warning: ${warning}`);
    }
    process.exit(1);
  }

  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }
  console.log(
    artifactsOnly
      ? "TerraQura production launch artifacts are present."
      : "TerraQura production launch gate passed.",
  );
}
