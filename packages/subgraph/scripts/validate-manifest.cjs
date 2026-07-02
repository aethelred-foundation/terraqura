const fs = require("node:fs");
const path = require("node:path");
const {
  DEPLOYMENTS,
  LEGACY_VALIDATION_DEPLOYMENT_KEY,
  NETWORKS,
} = require("@terraqura/network-manifest");

const subgraphPath = path.join(__dirname, "..", "subgraph.yaml");
const subgraph = fs.readFileSync(subgraphPath, "utf8");
const deployment = DEPLOYMENTS[LEGACY_VALIDATION_DEPLOYMENT_KEY];
const network = NETWORKS[deployment.network];

const requiredBindings = [
  ["CarbonCredit", deployment.contracts.carbonCredit],
  ["VerificationEngine", deployment.contracts.verificationEngine],
  ["CarbonMarketplace", deployment.contracts.carbonMarketplace],
];

const errors = [];

for (const [name, address] of requiredBindings) {
  if (!subgraph.includes(address)) {
    errors.push(`${name} address ${address} is not present in subgraph.yaml`);
  }
}

if (!subgraph.includes("network: matic-amoy")) {
  errors.push(
    "subgraph.yaml must remain explicitly marked as the legacy matic-amoy validation subgraph",
  );
}

if (network.role !== "legacy-validation") {
  errors.push(
    `subgraph validation deployment ${deployment.key} must be marked as legacy-validation`,
  );
}

if (errors.length > 0) {
  console.error("Subgraph manifest validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Subgraph manifest matches legacy validation deployment ${deployment.key} (${deployment.source}); active target remains Aethelred.`,
);
