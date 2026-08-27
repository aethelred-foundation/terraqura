import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import { isAbsolute } from "node:path";

type DeploymentEnvironment = NodeJS.ProcessEnv;

export const LEGACY_PRIVATE_KEY_ERROR =
  "PRIVATE_KEY is set in the current process. DEPLOYER_SIGNER_KEY_FILE does not override this legacy variable during the deployment ceremony. Run `unset PRIVATE_KEY`, remove any PRIVATE_KEY entry from the repository-root .env.local, source only the reviewed operator env file, and retry. Use `pnpm contracts:signer-key:check` to validate the key file without printing its contents.";

function legacyPrivateKey(
  environment: DeploymentEnvironment,
): string | undefined {
  const value = environment.PRIVATE_KEY?.trim();
  return value || undefined;
}

export function shouldLoadDeveloperEnv(
  environment: DeploymentEnvironment = process.env,
): boolean {
  return !environment.TERRAQURA_DEPLOY_PHASE?.trim();
}

export function assertLegacyPrivateKeyUnset(
  environment: DeploymentEnvironment = process.env,
): void {
  if (legacyPrivateKey(environment)) {
    throw new Error(LEGACY_PRIVATE_KEY_ERROR);
  }
}

export function readDeploymentSignerKeyFile(
  environment: DeploymentEnvironment = process.env,
): string {
  assertLegacyPrivateKeyUnset(environment);

  const keyFile = environment.DEPLOYER_SIGNER_KEY_FILE?.trim();
  if (!keyFile) {
    throw new Error("DEPLOYER_SIGNER_KEY_FILE must be configured");
  }
  if (!isAbsolute(keyFile)) {
    throw new Error("DEPLOYER_SIGNER_KEY_FILE must be an absolute path");
  }

  let pathStatus;
  try {
    pathStatus = lstatSync(keyFile);
  } catch {
    throw new Error(
      `DEPLOYER_SIGNER_KEY_FILE is not readable at the configured path: ${keyFile}`,
    );
  }
  if (pathStatus.isSymbolicLink()) {
    throw new Error("DEPLOYER_SIGNER_KEY_FILE must not be a symbolic link");
  }

  let fileDescriptor: number;
  let key: string;
  try {
    fileDescriptor = openSync(
      keyFile,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
  } catch {
    throw new Error(
      `DEPLOYER_SIGNER_KEY_FILE is not readable at the configured path: ${keyFile}`,
    );
  }
  try {
    const fileStatus = fstatSync(fileDescriptor);
    const permissions = fileStatus.mode & 0o777;
    if (
      !fileStatus.isFile() ||
      (permissions !== 0o400 && permissions !== 0o600)
    ) {
      throw new Error(
        "DEPLOYER_SIGNER_KEY_FILE must be a regular file without group or world permissions (mode 0400 or 0600)",
      );
    }
    key = readFileSync(fileDescriptor, "utf8").trim();
  } finally {
    closeSync(fileDescriptor);
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      "DEPLOYER_SIGNER_KEY_FILE must contain exactly one 0x-prefixed 32-byte private key",
    );
  }
  return key;
}

export function readDeveloperDeploymentKey(
  environment: DeploymentEnvironment = process.env,
): string | undefined {
  const keyFile = environment.DEPLOYER_SIGNER_KEY_FILE?.trim();
  if (keyFile) {
    return readDeploymentSignerKeyFile({ ...environment, PRIVATE_KEY: "" });
  }
  const key = legacyPrivateKey(environment);
  if (key && !/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error("Deployment signer secret is not a valid private key");
  }
  return key;
}
