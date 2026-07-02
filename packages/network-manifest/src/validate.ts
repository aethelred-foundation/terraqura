import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { stringifyPortableNetworkManifest, validateDeploymentManifest } from "./index.js";

const errors = validateDeploymentManifest();

const packageRoot = process.cwd();
const portableManifestPath = resolve(packageRoot, "manifest.json");

try {
  const checkedInManifest = readFileSync(portableManifestPath, "utf8");
  const generatedManifest = stringifyPortableNetworkManifest();

  if (checkedInManifest !== generatedManifest) {
    errors.push(
      `Portable manifest drift detected at ${portableManifestPath}. Run "pnpm --filter @terraqura/network-manifest manifest:json".`,
    );
  }
} catch (error) {
  errors.push(`Unable to read portable manifest at ${portableManifestPath}: ${String(error)}`);
}

if (errors.length > 0) {
  console.error("TerraQura network manifest validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("TerraQura network manifest validation passed.");
