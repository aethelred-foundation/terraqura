import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const errors = [];
const rootPackageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);

const ignoredPathParts = new Set([
  ".git",
  ".next",
  ".turbo",
  "node_modules",
  "dist",
  "artifacts",
  "cache",
  "target",
  "__pycache__",
  ".pytest_cache",
  "typechain-types",
  // Local Python virtualenvs: vendored numpy/scipy/pandas test fixtures
  // contain numeric strings (e.g. "0.123457") that false-positive the stale
  // chain-id scan. Environments are not repo source.
  ".venv",
  "venv",
  "site-packages",
]);

const scanRoots = ["apps", "packages", "docs", "infrastructure"];
const forbiddenPatterns = [
  {
    pattern: /123457/g,
    message: "stale Aethelred testnet chain id 123457",
  },
  {
    pattern: /78431/g,
    message: "stale Aethelred mainnet chain id 78431",
  },
  // 8821/88210 were never-deployed manifest-1.0.0 placeholders (8821 is the
  // SLIP-44 coin type, not a chain id). Context-anchored to avoid matching
  // the digits inside hashes/ABIs.
  {
    pattern: /chain[\s_-]?id\D{0,12}\b8821\b/gi,
    message: "stale Aethelred chain id 8821 (never-deployed placeholder; canonical is 7331)",
  },
  {
    pattern: /chain[\s_-]?id\D{0,12}\b88210\b/gi,
    message: "stale Aethelred chain id 88210 (never-deployed placeholder; canonical is 7332)",
  },
  // The pre-canonical EVM RPC host naming; canonical hosts are evm-rpc.* /
  // evm-rpc-testnet.* per aethelred ecosystem/manifest.json v2.0.0.
  {
    pattern: /https:\/\/rpc\.aethelred\.network|https:\/\/rpc-testnet\.aethelred\.network/g,
    message: "stale Aethelred RPC host (canonical naming is evm-rpc.aethelred.network / evm-rpc-testnet.aethelred.network)",
  },
  {
    pattern: /testnet-rpc\.aethelred/g,
    message: "stale Aethelred testnet RPC host",
  },
  {
    pattern: /polygon-rpc|polygon_rpc|polygon_latest_block|polygon_gas_price/g,
    message: "legacy Polygon monitoring identifier",
  },
];

const activeDocForbiddenPatterns = [
  {
    file: "apps/docs/docs/getting-started.md",
    pattern: /POLYGON_RPC_URL|deploy:amoy|Polygon Amoy testnet/g,
    message: "getting-started docs still instruct Polygon/Amoy setup",
  },
  {
    file: "apps/docs/docs/contracts/overview.md",
    pattern: /Polygon PoS|PolygonScan|polygonscan\.com/g,
    message:
      "contracts overview still presents Polygon as the active deployment",
  },
  {
    file: "apps/contracts/package.json",
    pattern: /polygonMainnet|polygonAmoy|deploy:amoy/g,
    message: "contract package exposes active Polygon deployment commands",
  },
];

const requiredFiles = [
  "packages/network-manifest/src/index.ts",
  "packages/database/src/domain/schema.sql",
  "packages/database/src/domain/index.ts",
  "apps/api/src/services/gasless/relayer.service.ts",
  "apps/api/src/services/graph/client.ts",
  "apps/api/src/services/iot-simulator/simulator.ts",
  "apps/api/src/lib/logger.ts",
  "apps/api/src/lib/state-store.ts",
  "apps/api/src/server.ts",
  "apps/api/src/services/kyc/sumsub.service.ts",
  "apps/web/src/lib/clientIds.ts",
  "apps/web/src/lib/dataMode.ts",
  "apps/web/src/lib/errors.ts",
  "apps/web/src/lib/random.ts",
  "apps/web/.env.example",
  "apps/web/next.config.js",
  "apps/web/src/app/layout.tsx",
  "apps/web/src/app/globals.css",
  "apps/web/src/app/error.tsx",
  "apps/web/src/app/global-error.tsx",
  "apps/web/src/app/web3-providers.tsx",
  "apps/web/src/lib/wagmi.ts",
  "apps/web/src/components/kyc/ComplianceGate.tsx",
  "apps/web/src/components/kyc/SumsubWidget.tsx",
  "apps/web/src/components/legal/LegalGate.tsx",
  "apps/web/src/components/legal/TermsModal.tsx",
  "apps/web/src/components/shared/OptimizedImage.tsx",
  "apps/worker/src/lib/logger.ts",
  "apps/worker/src/processors/verification.processor.ts",
  "apps/analytics/src/terraqura_analytics/services/analytics_service.py",
  "packages/sdk/src/modules/checkout.ts",
  "packages/sdk/src/modules/insurance.ts",
  "packages/sdk/src/modules/risk.ts",
  "packages/sdk/src/modules/sovereign.ts",
  "packages/queue/src/logger.ts",
  "packages/queue/src/queues.ts",
  "packages/database/src/logger.ts",
  "packages/monitoring/src/alerts.ts",
  "infrastructure/monitoring/alerting-rules.yml",
  "docs/operations/ALERT_RUNBOOKS.md",
  "docs/operations/SERVICE_OWNERSHIP_AND_SLOS.md",
  "docs/compliance/DATA_GOVERNANCE_AND_AUDIT_EXPORT.md",
  "docs/security/EXPLOIT_SIMULATION_MATRIX.md",
  "infrastructure/monitoring/alertmanager.yml",
  "docs/platform/NETWORK_DEPLOYMENT_MANIFEST.md",
  "docs/platform/GOLDEN_WORKFLOWS.md",
  "docs/platform/ENTERPRISE_READINESS.md",
  "docs/platform/CONSULTANT_HARDENING_REGISTER.md",
  "docs/platform/GOLDEN_WORKFLOW_STATE_MACHINE.md",
  "docs/platform/DASHBOARD_DATA_PROVENANCE_INVENTORY.md",
  "docs/platform/PRODUCTION_EVIDENCE_PACK.md",
  "scripts/create-production-evidence-pack.mjs",
  "scripts/production-launch-gate.mjs",
  "scripts/production-launch-gate.test.mjs",
  "packages/subgraph/scripts/validate-manifest.cjs",
];

function shouldIgnore(path) {
  return path.split("/").some((part) => ignoredPathParts.has(part));
}

function collectFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const relPath = relative(root, fullPath);
    if (shouldIgnore(relPath)) {
      continue;
    }

    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (stats.isFile() && !relPath.endsWith(".tsbuildinfo")) {
      files.push(fullPath);
    }
  }
  return files;
}

function readText(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

function stripYamlScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parsePrometheusAlerts(alertRulesText) {
  return alertRulesText
    .split(/\n\s*-\s+alert:\s*/)
    .slice(1)
    .map((block) => {
      const [rawName, ...lines] = block.split("\n");
      const alert = {
        name: rawName.trim(),
        labels: {},
      };

      let section = "";
      for (const line of lines) {
        const sectionMatch = line.match(/^\s+(labels|annotations):\s*$/);
        if (sectionMatch) {
          section = sectionMatch[1];
          continue;
        }

        if (section !== "labels") {
          continue;
        }

        const labelMatch = line.match(
          /^\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.+?)\s*$/,
        );
        if (labelMatch) {
          alert.labels[labelMatch[1]] = stripYamlScalar(labelMatch[2]);
        }
      }

      return alert;
    })
    .filter((alert) => alert.name.length > 0);
}

for (const relPath of requiredFiles) {
  try {
    statSync(join(root, relPath));
  } catch {
    errors.push(`Required enterprise artifact is missing: ${relPath}`);
  }
}

for (const scanRoot of scanRoots) {
  for (const filePath of collectFiles(join(root, scanRoot))) {
    const relPath = relative(root, filePath);
    const text = readFileSync(filePath, "utf8");
    for (const { pattern, message } of forbiddenPatterns) {
      if (pattern.test(text)) {
        errors.push(`${relPath}: contains ${message}`);
      }
      pattern.lastIndex = 0;
    }
  }
}

for (const { file, pattern, message } of activeDocForbiddenPatterns) {
  const text = readText(file);
  if (pattern.test(text)) {
    errors.push(`${file}: ${message}`);
  }
}

const contractsPackageJson = JSON.parse(
  readText("apps/contracts/package.json"),
);
const rootSecuritySimulationScript =
  rootPackageJson.scripts?.["test:security-sim"] ?? "";
if (
  !rootSecuritySimulationScript.includes("apps/contracts") ||
  !rootSecuritySimulationScript.includes("./node_modules/.bin/hardhat")
) {
  errors.push(
    "root package does not expose the focused security simulation command",
  );
}
const rootApiGoldenTestScript =
  rootPackageJson.scripts?.["test:api-golden"] ?? "";
if (
  !rootApiGoldenTestScript.includes("apps/api") ||
  !rootApiGoldenTestScript.includes("test/integration/full-flow.test.ts")
) {
  errors.push("root package does not expose the API golden workflow test");
}
const rootDatabaseDomainTestScript =
  rootPackageJson.scripts?.["test:database-domain"] ?? "";
if (
  !rootDatabaseDomainTestScript.includes("packages/database") ||
  !rootDatabaseDomainTestScript.includes("domain-audit-export.test.ts")
) {
  errors.push(
    "root package does not expose the database domain audit export test",
  );
}
const rootProductionArtifactsScript =
  rootPackageJson.scripts?.["validate:production-artifacts"] ?? "";
if (
  !rootProductionArtifactsScript.includes("production-launch-gate.mjs") ||
  !rootProductionArtifactsScript.includes("--artifacts-only")
) {
  errors.push(
    "root package does not expose the production artifact validation gate",
  );
}
const rootProductionLaunchScript =
  rootPackageJson.scripts?.["validate:production-launch"] ?? "";
if (!rootProductionLaunchScript.includes("production-launch-gate.mjs")) {
  errors.push("root package does not expose the production launch gate");
}
const rootProductionLaunchGateTestScript =
  rootPackageJson.scripts?.["test:production-launch-gate"] ?? "";
if (
  !rootProductionLaunchGateTestScript.includes("node --test") ||
  !rootProductionLaunchGateTestScript.includes("production-launch-gate.test.mjs")
) {
  errors.push("root package does not expose the production launch gate tests");
}
const rootEvidenceTemplateScript =
  rootPackageJson.scripts?.["evidence:production-template"] ?? "";
if (!rootEvidenceTemplateScript.includes("create-production-evidence-pack.mjs")) {
  errors.push("root package does not expose the production evidence pack generator");
}
const enterpriseValidationScript =
  rootPackageJson.scripts?.["validate:enterprise"] ?? "";
const networkValidationScript =
  rootPackageJson.scripts?.["validate:network"] ?? "";
if (
  !networkValidationScript.includes("packages/network-manifest") ||
  networkValidationScript.includes("pnpm")
) {
  errors.push(
    "network validation script is not pinned to package-local manifest tooling",
  );
}
if (
  !enterpriseValidationScript.includes(
    "corepack pnpm@9.0.0 validate:network",
  ) ||
  !enterpriseValidationScript.includes(
    "node ./scripts/validate-manifest.cjs",
  ) ||
  !enterpriseValidationScript.includes("corepack pnpm@9.0.0 test:api-golden") ||
  !enterpriseValidationScript.includes(
    "corepack pnpm@9.0.0 test:database-domain",
  ) ||
  !enterpriseValidationScript.includes("corepack pnpm@9.0.0 test:security-sim") ||
  !enterpriseValidationScript.includes(
    "corepack pnpm@9.0.0 test:production-launch-gate",
  ) ||
  !enterpriseValidationScript.includes(
    "corepack pnpm@9.0.0 validate:production-artifacts",
  )
) {
  errors.push(
    "enterprise validation script does not pin pnpm 9 and run golden/domain/security/artifact gates",
  );
}
const networkManifestPackageJson = JSON.parse(
  readText("packages/network-manifest/package.json"),
);
if (/pnpm/.test(networkManifestPackageJson.scripts?.validate ?? "")) {
  errors.push(
    "network-manifest package validate script still shells out to pnpm",
  );
}
const subgraphPackageJson = JSON.parse(
  readText("packages/subgraph/package.json"),
);
if (/pnpm/.test(subgraphPackageJson.scripts?.["validate:manifest"] ?? "")) {
  errors.push("subgraph manifest validation still shells out to pnpm");
}
const databasePackageJson = JSON.parse(
  readText("packages/database/package.json"),
);
if (
  !databasePackageJson.scripts?.["test:domain"]?.includes(
    "node --import tsx/esm tests/domain-audit-export.test.ts",
  )
) {
  errors.push("database package does not expose the domain audit export test");
}
const subgraphManifestValidator = readText(
  "packages/subgraph/scripts/validate-manifest.cjs",
);
if (
  !subgraphManifestValidator.includes("LEGACY_VALIDATION_DEPLOYMENT_KEY") ||
  !subgraphManifestValidator.includes("active target remains Aethelred")
) {
  errors.push(
    "subgraph manifest validator does not clearly label legacy validation evidence",
  );
}

const productionLaunchGate = readText("scripts/production-launch-gate.mjs");
for (const requiredGateTerm of [
  "TERRAQURA_LAUNCH_PROFILE",
  "golden-workflow",
  "NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE",
  "TERRAQURA_PRODUCTION_EVIDENCE_PACK",
  "TERRAQURA_ALLOW_DIRTY_RELEASE",
  "TERRAQURA_RELEASE_ARTIFACT_POLICY_ACK",
  "pending-deployment",
  "primary-target",
  "nativeIoTOracle",
  "requiredEvidencePackHeadings",
  "Decision: GO",
  "Open critical exceptions",
  "No production secrets committed: yes",
]) {
  if (!productionLaunchGate.includes(requiredGateTerm)) {
    errors.push(
      `production launch gate is missing required control ${requiredGateTerm}`,
    );
  }
}

const consultantHardeningRegister = readText(
  "docs/platform/CONSULTANT_HARDENING_REGISTER.md",
);
for (const requiredRegisterTerm of [
  "Critical Priority",
  "High Priority",
  "Medium Priority",
  "production launch gate",
  "Freeze a clean release candidate",
  "Remove ambiguity from live vs preview product data",
  "Create a production evidence pack",
]) {
  if (!consultantHardeningRegister.includes(requiredRegisterTerm)) {
    errors.push(
      `consultant hardening register is missing ${requiredRegisterTerm}`,
    );
  }
}

const goldenWorkflowStateMachine = readText(
  "docs/platform/GOLDEN_WORKFLOW_STATE_MACHINE.md",
);
for (const requiredStateMachineTerm of [
  "operator onboarding -> telemetry ingestion -> verification -> minting -> retirement -> audit export",
  "Approval Boundary",
  "Authoritative Data Handoff",
  "Domain Event",
  "Replay Safety",
  "audit_export.generated",
]) {
  if (!goldenWorkflowStateMachine.includes(requiredStateMachineTerm)) {
    errors.push(
      `golden workflow state machine is missing ${requiredStateMachineTerm}`,
    );
  }
}

const dashboardDataInventory = readText(
  "docs/platform/DASHBOARD_DATA_PROVENANCE_INVENTORY.md",
);
for (const requiredInventoryTerm of [
  "Live",
  "Preview",
  "Mixed",
  "No critical buyer, operator, sovereign, minting, retirement, or compliance view may depend on preview data in production.",
  "NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=live",
]) {
  if (!dashboardDataInventory.includes(requiredInventoryTerm)) {
    errors.push(
      `dashboard data provenance inventory is missing ${requiredInventoryTerm}`,
    );
  }
}

const productionEvidencePack = readText(
  "docs/platform/PRODUCTION_EVIDENCE_PACK.md",
);
for (const requiredEvidenceTerm of [
  "Go/No-Go",
  "Deployment Manifest",
  "Golden Workflow Drill",
  "Health Checks",
  "Audit Lineage",
  "output/evidence/terraqura-production-evidence-pack.md",
  "Gate-Checked Fields",
  "Decision: GO",
  "Open critical exceptions: none",
  "No production secrets committed: yes",
  "pnpm evidence:production-template",
]) {
  if (!productionEvidencePack.includes(requiredEvidenceTerm)) {
    errors.push(
      `production evidence pack template is missing ${requiredEvidenceTerm}`,
    );
  }
}

const productionEvidenceGenerator = readText(
  "scripts/create-production-evidence-pack.mjs",
);
for (const requiredGeneratorTerm of [
  "Decision: NO-GO",
  "aethelredMainnetPending",
  "packages/network-manifest/manifest.json",
  "NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE=pending",
  "No production secrets committed: no",
  "operator onboarding -> telemetry ingestion -> verification -> minting -> retirement -> audit export",
]) {
  if (!productionEvidenceGenerator.includes(requiredGeneratorTerm)) {
    errors.push(
      `production evidence generator is missing ${requiredGeneratorTerm}`,
    );
  }
}
const productionLaunchGateTest = readText("scripts/production-launch-gate.test.mjs");
for (const requiredGateTestTerm of [
  "--artifacts-only",
  "generated evidence scaffold is rejected",
  "finalized evidence content passes evidence checks",
  "Decision: GO",
  "No production secrets committed: yes",
]) {
  if (!productionLaunchGateTest.includes(requiredGateTestTerm)) {
    errors.push(`production launch gate test is missing ${requiredGateTestTerm}`);
  }
}
if (
  !contractsPackageJson.scripts?.["test:security-sim"]?.includes(
    "SabotagePathTests.test.ts",
  )
) {
  errors.push(
    "contracts package security simulation does not include sabotage path tests",
  );
}
if (
  !contractsPackageJson.scripts?.["test:security-sim"]?.includes(
    "MultisigFaultInjection.test.ts",
  )
) {
  errors.push(
    "contracts package security simulation does not include multisig fault injection tests",
  );
}
if (
  !contractsPackageJson.scripts?.["test:security-sim"]?.includes(
    "GaslessMetaTransaction.test.ts",
  )
) {
  errors.push(
    "contracts package security simulation does not include gasless replay/impersonation tests",
  );
}
if (
  !contractsPackageJson.scripts?.["test:security-sim"]?.includes(
    "CircuitBreaker.test.ts",
  )
) {
  errors.push(
    "contracts package security simulation does not include circuit breaker tests",
  );
}

const exploitSimulationMatrix = readText(
  "docs/security/EXPLOIT_SIMULATION_MATRIX.md",
);
for (const requiredSimulationTerm of [
  "Poisoned ERC-1155 receiver",
  "Zombie timelock operation",
  "Replay attack",
  "Forwarder impersonation",
  "Global circuit breaker pause",
  "68 passing",
]) {
  if (!exploitSimulationMatrix.includes(requiredSimulationTerm)) {
    errors.push(
      `exploit simulation matrix is missing ${requiredSimulationTerm}`,
    );
  }
}

for (const scanRoot of ["apps/api/src/routes/v1", "apps/api/src/lib"]) {
  for (const filePath of collectFiles(join(root, scanRoot))) {
    const relPath = relative(root, filePath);
    if (/\.(test|spec)\.ts$/.test(relPath)) {
      continue;
    }

    const text = readFileSync(filePath, "utf8");
    if (/Math\.random|Math\.floor\(Math\.random/.test(text)) {
      errors.push(
        `${relPath}: production API mutation/control code must use crypto-backed randomness`,
      );
    }
  }
}

for (const scanRoot of ["apps/api/src"]) {
  for (const filePath of collectFiles(join(root, scanRoot))) {
    const relPath = relative(root, filePath);
    if (/\.(test|spec)\.ts$/.test(relPath)) {
      continue;
    }

    const text = readFileSync(filePath, "utf8");
    if (/console\.(log|info|warn|error)/.test(text)) {
      errors.push(
        `${relPath}: production API source must use structured logger instead of raw console`,
      );
    }
  }
}

for (const scanRoot of ["packages/sdk/src"]) {
  for (const filePath of collectFiles(join(root, scanRoot))) {
    const relPath = relative(root, filePath);
    if (/\.(test|spec)\.ts$/.test(relPath) || relPath.includes("/__test__/")) {
      continue;
    }

    const text = readFileSync(filePath, "utf8");
    if (/Math\.random/.test(text)) {
      errors.push(
        `${relPath}: SDK production code must avoid predictable Math.random`,
      );
    }
  }
}
const sdkUtils = readText("packages/sdk/src/utils.ts");
if (!sdkUtils.includes("0x100000000") || sdkUtils.includes("0xffffffff")) {
  errors.push(
    "SDK retry jitter must use a half-open crypto-random unit interval",
  );
}

const verificationProcessor = readText(
  "apps/worker/src/processors/verification.processor.ts",
);
if (
  /Simulated metrics for demonstration|Simulated checks for now/.test(
    verificationProcessor,
  )
) {
  errors.push(
    "verification worker still contains demonstration-only verification metrics",
  );
}
if (!verificationProcessor.includes("VERIFICATION_ALLOW_DERIVED_SNAPSHOT")) {
  errors.push(
    "verification worker does not expose an explicit local-drill evidence override",
  );
}
if (!verificationProcessor.includes("missing telemetrySnapshot evidence")) {
  errors.push(
    "verification worker does not fail fast when telemetry evidence is missing",
  );
}

const workerLogger = readText("apps/worker/src/lib/logger.ts");
if (
  !workerLogger.includes("pino") ||
  !workerLogger.includes("WORKER_LOG_REDACTION_PATHS")
) {
  errors.push(
    "worker runtime does not use a shared structured logger with redaction policy",
  );
}
if (
  !workerLogger.includes("redact") ||
  !workerLogger.includes("serializeError")
) {
  errors.push(
    "worker logger does not enforce redaction and safe error serialization",
  );
}
if (!workerLogger.includes("logReference")) {
  errors.push(
    "worker logger does not expose deterministic references for sensitive identifiers",
  );
}

for (const relPath of [
  "apps/worker/src/index.ts",
  "apps/worker/src/processors/minting.processor.ts",
  "apps/worker/src/processors/verification.processor.ts",
  "apps/worker/src/processors/kyc.processor.ts",
]) {
  const text = readText(relPath);
  if (
    /console\.(log|info|warn|error)|const logger = console|Replace with proper logger/.test(
      text,
    )
  ) {
    errors.push(
      `${relPath}: worker runtime code still uses raw console logging`,
    );
  }
}

const kycProcessor = readText("apps/worker/src/processors/kyc.processor.ts");
if (
  /Sumsub API error: \$\{response\.status\} \$\{body\}|Onfido API error: \$\{response\.status\} \$\{body\}/.test(
    kycProcessor,
  )
) {
  errors.push(
    "KYC processor still copies provider response bodies into errors",
  );
}
if (
  /user \$\{userId\}|applicant: \$\{applicantId\}|\(\$\{walletAddress\}\)/.test(
    kycProcessor,
  )
) {
  errors.push(
    "KYC processor still logs raw user, wallet, or applicant identifiers",
  );
}
if (!kycProcessor.includes("logReference")) {
  errors.push(
    "KYC processor does not use deterministic redacted references for sensitive identifiers",
  );
}

const analyticsService = readText(
  "apps/analytics/src/terraqura_analytics/services/analytics_service.py",
);
const analyticsConfig = readText(
  "apps/analytics/src/terraqura_analytics/config.py",
);
if (/deterministic demo data|demo data suitable/i.test(analyticsService)) {
  errors.push(
    "analytics service still presents synthetic demo data as production analytics",
  );
}
if (!analyticsService.includes("allow_synthetic_data")) {
  errors.push(
    "analytics service does not require an explicit synthetic-data opt-in",
  );
}
if (!analyticsService.includes("AnalyticsDataUnavailable")) {
  errors.push(
    "analytics service does not fail closed when live data is unavailable",
  );
}
if (
  !analyticsConfig.includes("LEGACY_VALIDATION_OPT_IN_ENV") ||
  !analyticsConfig.includes("_assert_runtime_network_allowed") ||
  !analyticsConfig.includes("legacy-validation")
) {
  errors.push(
    "analytics runtime does not fail closed for legacy validation network selection",
  );
}

const indexerConfig = readText("apps/indexer/internal/config/config.go");
if (
  !indexerConfig.includes("legacyValidationOptInEnv") ||
  !indexerConfig.includes("assertRuntimeNetworkAllowed") ||
  !indexerConfig.includes("legacy-validation")
) {
  errors.push(
    "Go indexer runtime does not fail closed for legacy validation network selection",
  );
}

const verifierConfig = readText("apps/verifier/src/config.rs");
if (
  !verifierConfig.includes("LEGACY_VALIDATION_OPT_IN_ENV") ||
  !verifierConfig.includes("assert_runtime_network_allowed") ||
  !verifierConfig.includes("legacy-validation")
) {
  errors.push(
    "Rust verifier runtime does not fail closed for legacy validation network selection",
  );
}

const gaslessRelayer = readText(
  "apps/api/src/services/gasless/relayer.service.ts",
);
if (
  /Fallback to direct relay for now|In production, use @openzeppelin\/defender-sdk/.test(
    gaslessRelayer,
  )
) {
  errors.push("gasless relayer still contains fake Defender fallback behavior");
}
if (
  !gaslessRelayer.includes(
    "Defender relay handler not configured; direct relay fallback is disabled",
  )
) {
  errors.push(
    "gasless relayer does not fail closed when Defender mode lacks a real handler",
  );
}
if (!gaslessRelayer.includes("RelayMode")) {
  errors.push("gasless relayer does not expose explicit relay mode selection");
}

const graphClient = readText("apps/api/src/services/graph/client.ts");
if (!graphClient.includes("normalizeGraphUrls")) {
  errors.push(
    "API graph client does not normalize primary/fallback subgraph URLs",
  );
}
if (!/finally\s*\{[\s\S]*clearTimeout/.test(graphClient)) {
  errors.push(
    "API graph client does not clear request timeouts on failed fetch paths",
  );
}

const iotSimulator = readText(
  "apps/api/src/services/iot-simulator/simulator.ts",
);
if (/Math\.random/.test(iotSimulator)) {
  errors.push("IoT simulator still uses predictable Math.random sampling");
}
if (!iotSimulator.includes("randomBytes")) {
  errors.push("IoT simulator does not use crypto-backed sampling");
}

const apiLogger = readText("apps/api/src/lib/logger.ts");
const apiStateStore = readText("apps/api/src/lib/state-store.ts");
const apiServer = readText("apps/api/src/server.ts");
const apiCreditsRoutes = readText("apps/api/src/routes/v1/credits.ts");
const apiMarketplaceRoutes = readText("apps/api/src/routes/v1/marketplace.ts");
if (
  !apiLogger.includes("API_LOG_REDACTION_PATHS") ||
  !apiLogger.includes("pino")
) {
  errors.push(
    "API services do not expose a shared structured logger with redaction policy",
  );
}
if (
  !apiLogger.includes("serializeError") ||
  !apiLogger.includes("logReference")
) {
  errors.push(
    "API logger does not expose safe error serialization and deterministic references",
  );
}
if (
  !apiStateStore.includes("closeStateStore") ||
  !apiStateStore.includes("pool.end()") ||
  !apiStateStore.includes("closePromise")
) {
  errors.push("API state store does not expose a Postgres pool shutdown hook");
}
if (
  !apiStateStore.includes("StateMutationContext") ||
  !apiStateStore.includes("typedDomainEvents")
) {
  errors.push(
    "API state-store mutations do not support typed domain events in the same transaction",
  );
}
for (const eventType of [
  "carbon_credit.minted",
  "carbon_credit.retired",
  "carbon_credit.partially_retired",
]) {
  if (!apiCreditsRoutes.includes(eventType)) {
    errors.push(
      `API credits route does not emit typed domain event ${eventType}`,
    );
  }
}
for (const eventType of ["market_listing.created", "market_purchase.settled"]) {
  if (!apiMarketplaceRoutes.includes(eventType)) {
    errors.push(
      `API marketplace route does not emit typed domain event ${eventType}`,
    );
  }
}
if (
  !apiServer.includes('addHook("onClose"') ||
  !apiServer.includes("closeStateStore")
) {
  errors.push(
    "API server does not close state-store resources during Fastify shutdown",
  );
}

const apiSumsubService = readText(
  "apps/api/src/services/kyc/sumsub.service.ts",
);
if (
  /response\.text\(\)|Sumsub API error: \$\{response\.status\} -/.test(
    apiSumsubService,
  )
) {
  errors.push(
    "API Sumsub service still copies provider response bodies into errors",
  );
}
if (/console\.(log|info|warn|error)/.test(apiSumsubService)) {
  errors.push("API Sumsub service still uses raw console logging");
}
if (
  !apiSumsubService.includes('Buffer.from(signature, "hex")') ||
  !apiSumsubService.includes("provided.length !== expected.length")
) {
  errors.push(
    "API Sumsub webhook signature verification does not safely reject malformed signatures",
  );
}
if (
  !apiSumsubService.includes("logReference") ||
  !apiSumsubService.includes("serializeError")
) {
  errors.push(
    "API Sumsub service does not use redacted references and safe error serialization",
  );
}

const apiKycRoutes = readText("apps/api/src/routes/v1/kyc.ts");
if (
  /fastify\.log\.info\(\{ payload \}|fastify\.log\.info\(\{ event \}/.test(
    apiKycRoutes,
  )
) {
  errors.push("API KYC routes still log raw queue payloads or webhook events");
}
if (!apiKycRoutes.includes("logReference")) {
  errors.push(
    "API KYC routes do not log deterministic references for sensitive identifiers",
  );
}

const apiWebhooksRoutes = readText("apps/api/src/routes/v1/webhooks.ts");
if (
  /In production, this payload would be POSTed|Test event generated/.test(
    apiWebhooksRoutes,
  )
) {
  errors.push(
    "API webhook test endpoint still contains placeholder delivery behavior",
  );
}
if (
  !apiWebhooksRoutes.includes("deliverWebhook") ||
  !apiWebhooksRoutes.includes("X-TerraQura-Signature")
) {
  errors.push(
    "API webhook test endpoint does not perform signed HTTP delivery",
  );
}
if (
  !apiWebhooksRoutes.includes("isBlockedWebhookHostname") ||
  !apiWebhooksRoutes.includes("WEBHOOK_ALLOW_LOCAL_DELIVERY")
) {
  errors.push(
    "API webhook registration does not enforce localhost/private-network delivery guardrails",
  );
}

const webErrorReporting = readText("apps/web/src/lib/errors.ts");
const webNextConfig = readText("apps/web/next.config.js");
const webLayout = readText("apps/web/src/app/layout.tsx");
const webGlobals = readText("apps/web/src/app/globals.css");
if (
  /placeholder for integration|TODO: Integrate with Sentry|In production, send to monitoring service/.test(
    webErrorReporting,
  )
) {
  errors.push(
    "web error reporting still contains placeholder monitoring integration",
  );
}
if (!webErrorReporting.includes("NEXT_PUBLIC_ERROR_REPORTING_URL")) {
  errors.push(
    "web error reporting does not require an explicit monitoring endpoint",
  );
}
if (!webErrorReporting.includes("ErrorReportResult")) {
  errors.push("web error reporting does not expose delivery outcomes");
}
if (!webErrorReporting.includes("reportClientError")) {
  errors.push(
    "web error reporting does not expose a shared client-side reporter",
  );
}
if (
  !webErrorReporting.includes("getSafeCurrentUrl") ||
  /window\.location\.href/.test(webErrorReporting)
) {
  errors.push(
    "web error reporting must strip query strings and fragments from reported URLs",
  );
}
if (
  !webErrorReporting.includes("resolveErrorReportingEndpoint") ||
  !webErrorReporting.includes("parsed.protocol !== 'https:'")
) {
  errors.push("web error reporting must reject insecure monitoring endpoints");
}
if (
  /next\/font\/google|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(
    webLayout + webNextConfig,
  )
) {
  errors.push(
    "web production build still depends on external Google Fonts at build/runtime",
  );
}
if (/source:\s*"\/_next\/image\/:path\*"/.test(webNextConfig)) {
  errors.push(
    "web Next image optimizer cache headers are overridden, causing noisy production builds",
  );
}
for (const token of [
  "--font-space-grotesk",
  "--font-inter",
  "--font-jetbrains",
]) {
  if (!webGlobals.includes(token)) {
    errors.push(
      `web design system is missing deterministic font token ${token}`,
    );
  }
}

for (const filePath of collectFiles(join(root, "apps/web/src"))) {
  const relPath = relative(root, filePath);
  if (
    /\.(test|spec)\.(ts|tsx)$/.test(relPath) ||
    relPath === "apps/web/src/lib/errors.ts"
  ) {
    continue;
  }

  const text = readFileSync(filePath, "utf8");
  if (/console\.(log|info|warn|error)/.test(text)) {
    errors.push(
      `${relPath}: web runtime code must use reportClientError instead of raw console logging`,
    );
  }
  if (/Math\.random/.test(text) && relPath !== "apps/web/src/lib/mockData.ts") {
    errors.push(
      `${relPath}: web runtime code must use crypto-backed or deterministic randomness instead of Math.random`,
    );
  }
}

for (const relPath of [
  "apps/web/src/app/error.tsx",
  "apps/web/src/app/global-error.tsx",
  "apps/web/src/app/web3-providers.tsx",
  "apps/web/src/lib/wagmi.ts",
  "apps/web/src/components/kyc/ComplianceGate.tsx",
  "apps/web/src/components/kyc/SumsubWidget.tsx",
  "apps/web/src/components/legal/LegalGate.tsx",
  "apps/web/src/components/legal/TermsModal.tsx",
  "apps/web/src/components/shared/OptimizedImage.tsx",
]) {
  const text = readText(relPath);
  if (!text.includes("reportClientError")) {
    errors.push(
      `${relPath}: web runtime failures are not wired to shared client error reporting`,
    );
  }
}

const webClientIds = readText("apps/web/src/lib/clientIds.ts");
const webDataMode = readText("apps/web/src/lib/dataMode.ts");
const webRandom = readText("apps/web/src/lib/random.ts");
const webEnvExample = readText("apps/web/.env.example");
if (
  !webClientIds.includes("randomUUID") ||
  !webClientIds.includes("getRandomValues")
) {
  errors.push("web client IDs do not use browser crypto APIs");
}
if (
  !webDataMode.includes("NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE") ||
  !webDataMode.includes('"preview"')
) {
  errors.push(
    "web dashboard data provenance is not centralized behind an explicit preview/live mode",
  );
}
if (
  !webRandom.includes("getRandomValues") ||
  !webRandom.includes("cryptoRandomFloat")
) {
  errors.push("web runtime randomness helpers do not use browser crypto APIs");
}
if (
  /polygonAmoy|Polygon Amoy|NEXT_PUBLIC_TERRAQURA_NETWORK=polygon/i.test(
    webEnvExample,
  )
) {
  errors.push(
    "web environment template still points new deployments at legacy Polygon configuration",
  );
}
for (const relPath of [
  "apps/web/src/contexts/AppContext.tsx",
  "apps/web/src/components/dashboard/RealtimeActivityFeed.tsx",
]) {
  const text = readText(relPath);
  if (/Date\.now\(\).*Math\.random|Math\.random\(\).*Date\.now/.test(text)) {
    errors.push(
      `${relPath}: web runtime IDs still use timestamp-plus-Math.random`,
    );
  }
}

const dashboardBanner = readText(
  "apps/web/src/components/dashboard/DemoBanner.tsx",
);
const realtimeFeed = readText(
  "apps/web/src/components/dashboard/RealtimeActivityFeed.tsx",
);
if (
  !dashboardBanner.includes("getDashboardDataMode") ||
  !dashboardBanner.includes("deterministic mock data")
) {
  errors.push(
    "dashboard preview/live provenance banner is not wired to centralized data mode",
  );
}
if (
  !realtimeFeed.includes("isPreviewDataMode") ||
  /\bPOL\b/.test(realtimeFeed)
) {
  errors.push(
    "realtime activity feed still injects preview data unconditionally or uses legacy currency labels",
  );
}

const checkoutModule = readText("packages/sdk/src/modules/checkout.ts");
const sdkWebhookManager = readText("packages/sdk/src/webhooks.ts");
const insuranceModule = readText("packages/sdk/src/modules/insurance.ts");
const riskModule = readText("packages/sdk/src/modules/risk.ts");
const sovereignModule = readText("packages/sdk/src/modules/sovereign.ts");
const sdkConstants = readText("packages/sdk/src/constants.ts");
const networkManifest = readText("packages/network-manifest/src/index.ts");
const sdkTypes = readText("packages/sdk/src/types.ts");
if (
  /Session store \(in-memory; production should use Redis\/DB\)/.test(
    checkoutModule,
  )
) {
  errors.push("SDK checkout still uses private in-memory-only session storage");
}
if (!checkoutModule.includes("CheckoutSessionBackend")) {
  errors.push(
    "SDK checkout does not expose a durable session backend contract",
  );
}
if (!sdkTypes.includes("checkoutSessionBackend")) {
  errors.push("SDK client config does not expose checkoutSessionBackend");
}
if (
  !/dispatchWebhook[\s\S]*finally\s*\{[\s\S]*clearTimeout/.test(checkoutModule)
) {
  errors.push(
    "SDK checkout webhook dispatch does not clear timeout handles on failed fetch paths",
  );
}
if (
  !/dispatchWebhook[\s\S]*finally\s*\{[\s\S]*clearTimeout/.test(
    sdkWebhookManager,
  )
) {
  errors.push(
    "SDK webhook manager does not clear timeout handles on failed fetch paths",
  );
}
if (
  /defaultScore|In production, this would query the on-chain oracle/.test(
    insuranceModule,
  )
) {
  errors.push(
    "SDK insurance module still contains hardcoded local premium defaults",
  );
}
if (!insuranceModule.includes("calculateInsurancePremium")) {
  errors.push(
    "SDK insurance async policy creation does not use RiskOracle-backed premium resolution",
  );
}
if (
  !insuranceModule.includes(
    "createPolicySync requires premiumOverrideBps or localHealthScore",
  )
) {
  errors.push(
    "SDK insurance sync policy creation does not fail closed without an explicit premium source",
  );
}
if (
  /circuitBreaker address slot|placeholder for pre-deployment|Future: this\.config\.addresses\.riskOracle/.test(
    riskModule,
  )
) {
  errors.push(
    "SDK risk module still contains placeholder RiskOracle address resolution",
  );
}
if (!riskModule.includes("this.config.addresses.riskOracle")) {
  errors.push(
    "SDK risk module does not resolve a dedicated RiskOracle address",
  );
}
if (!sdkTypes.includes("riskOracleAddress")) {
  errors.push("SDK client config does not expose riskOracleAddress");
}
if (!sdkConstants.includes("riskOracle: addresses.riskOracle")) {
  errors.push("SDK contract addresses do not include RiskOracle");
}
if (!networkManifest.includes('riskOracle: "RISK_ORACLE"')) {
  errors.push(
    "network manifest does not expose TERRAQURA_CONTRACT_RISK_ORACLE override support",
  );
}
if (
  !networkManifest.includes("LEGACY_VALIDATION_OPT_IN_ENV") ||
  !networkManifest.includes(
    "NEXT_PUBLIC_TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT",
  ) ||
  !networkManifest.includes("legacyValidationOptInEnabled")
) {
  errors.push(
    "network manifest does not expose an explicit legacy validation opt-in contract",
  );
}
if (
  !networkManifest.includes("assertRuntimeNetworkAllowed") ||
  !/getActiveNetworkKey[\s\S]*assertRuntimeNetworkAllowed\(configured, env\)/.test(
    networkManifest,
  )
) {
  errors.push(
    "network manifest does not fail closed when legacy validation networks are selected",
  );
}
if (
  !networkManifest.includes("assertRuntimeDeploymentAllowed") ||
  !/getActiveDeploymentKey[\s\S]*assertRuntimeDeploymentAllowed\(configured, env\)/.test(
    networkManifest,
  )
) {
  errors.push(
    "network manifest does not fail closed when legacy validation deployments are selected",
  );
}
if (
  /synthetic health estimate|In production, this queries the Risk Oracle|In production, this queries the subgraph|credits are tagged with sector metadata on-chain/.test(
    sovereignModule,
  )
) {
  errors.push(
    "SDK sovereign module still contains synthetic fleet-health or sector-tag placeholders",
  );
}
if (!sovereignModule.includes("getAverageFleetHealthFromRiskProfiles")) {
  errors.push(
    "SDK sovereign inventory does not resolve fleet health from RiskOracle profiles",
  );
}
if (!sovereignModule.includes("sectorAllocations")) {
  errors.push(
    "SDK sovereign inventory does not support explicit sector allocation evidence",
  );
}

const queueHelpers = readText("packages/queue/src/queues.ts");
const queueConnection = readText("packages/queue/src/connection.ts");
const queueLogger = readText("packages/queue/src/logger.ts");
const databaseLogger = readText("packages/database/src/logger.ts");
const timescaleClient = readText("packages/database/src/timescale/index.ts");
if (/notify-\$\{Date\.now\(\)\}|ipfs-\$\{Date\.now\(\)\}/.test(queueHelpers)) {
  errors.push(
    "queue helpers still use timestamp-only notification/IPFS job ids",
  );
}
if (!queueHelpers.includes("idempotencyKey")) {
  errors.push(
    "queue helper job data does not expose producer idempotency keys",
  );
}
if (!queueHelpers.includes("randomUUID")) {
  errors.push("queue helpers do not use collision-resistant generated job ids");
}
if (/console\.(log|info|warn|error)/.test(queueConnection)) {
  errors.push("queue Redis connection manager still uses raw console logging");
}
if (
  !queueConnection.includes("getQueueLogger") ||
  !queueConnection.includes("serializeError")
) {
  errors.push(
    "queue Redis connection manager does not use structured queue logging",
  );
}
if (
  !queueLogger.includes("setQueueLogger") ||
  !queueLogger.includes("redactValue")
) {
  errors.push(
    "queue package does not expose injectable structured logging with redaction",
  );
}
if (/console\.(log|info|warn|error)/.test(timescaleClient)) {
  errors.push("TimescaleDB client still uses raw console logging");
}
if (
  !timescaleClient.includes("getDatabaseLogger") ||
  !timescaleClient.includes("serializeDatabaseError")
) {
  errors.push(
    "TimescaleDB client does not route pool errors through structured database logging",
  );
}
if (
  !databaseLogger.includes("setDatabaseLogger") ||
  !databaseLogger.includes("redactValue") ||
  !databaseLogger.includes("DATABASE_LOG_LEVEL")
) {
  errors.push(
    "database package does not expose injectable structured logging with redaction",
  );
}

const alertingService = readText("packages/monitoring/src/alerts.ts");
if (
  /alert-\$\{now\}-\$\{Math\.random|Email alert would be sent|In production, use nodemailer/.test(
    alertingService,
  )
) {
  errors.push(
    "monitoring alerting still contains weak IDs or console-only delivery stubs",
  );
}
if (!alertingService.includes("randomUUID")) {
  errors.push("monitoring alert IDs are not crypto-backed");
}
if (!alertingService.includes("AlertDeliveryReport")) {
  errors.push(
    "monitoring alerting does not report per-channel delivery outcomes",
  );
}
if (!alertingService.includes("emailTransport")) {
  errors.push(
    "monitoring alerting does not require an explicit email transport",
  );
}

const prometheusAlertRules = readText(
  "infrastructure/monitoring/alerting-rules.yml",
);
const alertRunbooks = readText("docs/operations/ALERT_RUNBOOKS.md");
const alertmanagerConfig = readText(
  "infrastructure/monitoring/alertmanager.yml",
);
const serviceOwnershipAndSlos = readText(
  "docs/operations/SERVICE_OWNERSHIP_AND_SLOS.md",
);
const prometheusAlerts = parsePrometheusAlerts(prometheusAlertRules);
const allowedAlertSeverities = new Set(["critical", "warning", "info"]);
const seenRunbookAnchors = new Map();

if (prometheusAlerts.length === 0) {
  errors.push("Prometheus alerting rules do not define any alerts");
}

for (const alert of prometheusAlerts) {
  const severity = alert.labels.severity;
  const category = alert.labels.category;
  const owner = alert.labels.owner;
  const runbook = alert.labels.runbook;

  if (!allowedAlertSeverities.has(severity)) {
    errors.push(
      `Prometheus alert ${alert.name} has missing or unsupported severity label`,
    );
  }
  if (!category) {
    errors.push(`Prometheus alert ${alert.name} is missing category label`);
  }
  if (!owner || !/^[a-z][a-z0-9-]*$/.test(owner)) {
    errors.push(
      `Prometheus alert ${alert.name} is missing a stable owner label`,
    );
  } else if (!serviceOwnershipAndSlos.includes(`\`${owner}\``)) {
    errors.push(
      `Prometheus alert ${alert.name} owner ${owner} is not registered in SERVICE_OWNERSHIP_AND_SLOS.md`,
    );
  }
  if (
    !runbook ||
    !/^https:\/\/docs\.terraqura\.io\/operations\/alert-runbooks#[a-z0-9-]+$/.test(
      runbook,
    )
  ) {
    errors.push(
      `Prometheus alert ${alert.name} is missing a stable public runbook URL`,
    );
    continue;
  }

  const anchor = runbook.split("#")[1];
  if (seenRunbookAnchors.has(anchor)) {
    errors.push(
      `Prometheus alerts ${seenRunbookAnchors.get(anchor)} and ${alert.name} share runbook anchor ${anchor}`,
    );
  }
  seenRunbookAnchors.set(anchor, alert.name);

  if (!alertRunbooks.includes(`id="${anchor}"`)) {
    errors.push(
      `Prometheus alert ${alert.name} runbook anchor ${anchor} is missing from docs/operations/ALERT_RUNBOOKS.md`,
    );
  }
}

for (const requiredAlertmanagerTerm of [
  "pagerduty-critical",
  "slack-ops-alerts",
  "slack-ops-monitoring",
  "slack-security-response",
  'severity="critical"',
  'owner="security-response"',
  "api_url_file",
  "routing_key_file",
  ".Labels.runbook",
]) {
  if (!alertmanagerConfig.includes(requiredAlertmanagerTerm)) {
    errors.push(
      `Alertmanager routing config is missing ${requiredAlertmanagerTerm}`,
    );
  }
}
if (
  /hooks\.slack\.com|routing_key:\s*["']?[A-Za-z0-9]/.test(alertmanagerConfig)
) {
  errors.push(
    "Alertmanager config appears to contain inline notification secrets instead of file-mounted secrets",
  );
}

for (const requiredSloHeading of [
  "## API Availability SLO",
  "## Web Dashboard SLO",
  "## Worker Processing SLO",
  "## Verification and MRV SLO",
  "## Database and Domain Event SLO",
  "## Redis and Queue Transport SLO",
  "## Chain RPC and Relayer SLO",
  "## Indexer and Subgraph Freshness SLO",
  "## Analytics Freshness SLO",
  "## Infrastructure and TLS SLO",
  "## Business Activity Review SLO",
]) {
  if (!serviceOwnershipAndSlos.includes(requiredSloHeading)) {
    errors.push(
      `service ownership/SLO document is missing ${requiredSloHeading}`,
    );
  }
}

const domainSchema = readText("packages/database/src/domain/schema.sql");
const domainIndex = readText("packages/database/src/domain/index.ts");
const apiFullFlowTest = readText("apps/api/test/integration/full-flow.test.ts");
for (const tableName of [
  "tenants",
  "tenant_memberships",
  "dac_facilities",
  "dac_units",
  "verification_batches",
  "carbon_instruments",
  "market_orders",
  "retirement_records",
]) {
  const unsafeCreate = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${tableName}\\b`,
    "i",
  );
  if (unsafeCreate.test(domainSchema)) {
    errors.push(`domain schema creates unprefixed table "${tableName}"`);
  }
}
if (
  !apiFullFlowTest.includes(
    "typed domain events link mint, trade, and retirement",
  ) ||
  !apiFullFlowTest.includes("carbon_credit.minted") ||
  !apiFullFlowTest.includes("market_listing.created") ||
  !apiFullFlowTest.includes("market_purchase.settled") ||
  !apiFullFlowTest.includes("carbon_credit.retired")
) {
  errors.push(
    "API golden workflow integration test does not assert the typed domain event spine",
  );
}
if (!domainIndex.includes("DOMAIN_AUDIT_EXPORT_FIELD_CLASSIFICATION")) {
  errors.push(
    "domain package does not publish audit export data classification",
  );
}
if (
  !domainIndex.includes("buildCarbonRemovalAuditLineageQuery") ||
  !domainIndex.includes("getCarbonRemovalAuditLineage")
) {
  errors.push(
    "domain package does not expose carbon-removal audit lineage export",
  );
}
if (
  !domainIndex.includes("payloadSha256") ||
  !domainIndex.includes("digest(de.payload::text, 'sha256')")
) {
  errors.push(
    "domain audit lineage export does not hash event payloads by default",
  );
}

const dataGovernanceDoc = readText(
  "docs/compliance/DATA_GOVERNANCE_AND_AUDIT_EXPORT.md",
);
for (const requiredGovernanceTerm of [
  "Data Classification",
  "Retention Policy",
  "Pseudonymization and Minimization",
  "Canonical Audit Export",
  "Lineage Contract",
]) {
  if (!dataGovernanceDoc.includes(requiredGovernanceTerm)) {
    errors.push(
      `data governance/audit export document is missing ${requiredGovernanceTerm}`,
    );
  }
}

if (errors.length > 0) {
  console.error("TerraQura enterprise readiness check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("TerraQura enterprise readiness check passed.");
