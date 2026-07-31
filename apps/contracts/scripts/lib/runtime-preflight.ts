import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const SUPPORTED_NODE_LINE = "20.18.x";
export const REVIEWED_NODE_VERSION = "20.18.3";
export const REVIEWED_PNPM_VERSION = "9.0.0";

interface RuntimePreflightInput {
  repositoryRoot: string;
  nodeVersion?: string;
  packageManagerUserAgent?: string;
}

export function assertSupportedRuntime({
  repositoryRoot,
  nodeVersion = process.versions.node,
  packageManagerUserAgent = process.env.npm_config_user_agent || "",
}: RuntimePreflightInput): void {
  const nvmVersion = readFileSync(
    resolve(repositoryRoot, ".nvmrc"),
    "utf8",
  ).trim();
  const nodeVersionFile = readFileSync(
    resolve(repositoryRoot, ".node-version"),
    "utf8",
  ).trim();
  const rootPackage = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
  ) as {
    engines?: { node?: string; pnpm?: string };
    packageManager?: string;
  };

  if (
    nvmVersion !== REVIEWED_NODE_VERSION ||
    nodeVersionFile !== REVIEWED_NODE_VERSION ||
    rootPackage.engines?.node !== SUPPORTED_NODE_LINE ||
    rootPackage.engines?.pnpm !== REVIEWED_PNPM_VERSION ||
    rootPackage.packageManager !== `pnpm@${REVIEWED_PNPM_VERSION}`
  ) {
    throw new Error(
      "Runtime selection files and package metadata must agree on Node 20.18.3 within the supported 20.18.x line and pnpm 9.0.0",
    );
  }
  if (nodeVersion !== REVIEWED_NODE_VERSION) {
    throw new Error(
      `Node ${SUPPORTED_NODE_LINE} is supported, but the deployment ceremony requires reviewed patch ${REVIEWED_NODE_VERSION}; found v${nodeVersion}`,
    );
  }
  if (!packageManagerUserAgent.startsWith(`pnpm/${REVIEWED_PNPM_VERSION} `)) {
    throw new Error(
      `pnpm ${REVIEWED_PNPM_VERSION} is required for the deployment ceremony`,
    );
  }
}
