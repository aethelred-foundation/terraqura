import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import { isAbsolute } from "node:path";

export function readModeRestrictedPrivateKeyFile(
  keyFile: string,
  variableName: string,
): string {
  if (!isAbsolute(keyFile)) {
    throw new Error(`${variableName} must be an absolute path`);
  }

  let pathStatus;
  try {
    pathStatus = lstatSync(keyFile);
  } catch {
    throw new Error(`${variableName} is not readable at the configured path`);
  }
  if (pathStatus.isSymbolicLink()) {
    throw new Error(`${variableName} must not be a symbolic link`);
  }

  let fileDescriptor: number;
  try {
    fileDescriptor = openSync(
      keyFile,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
  } catch {
    throw new Error(`${variableName} is not readable at the configured path`);
  }

  let privateKey: string;
  try {
    const fileStatus = fstatSync(fileDescriptor);
    const permissions = fileStatus.mode & 0o777;
    if (
      !fileStatus.isFile() ||
      (permissions !== 0o400 && permissions !== 0o600)
    ) {
      throw new Error(
        `${variableName} must be a regular file without group or world permissions (mode 0400 or 0600)`,
      );
    }
    privateKey = readFileSync(fileDescriptor, "utf8").trim();
  } finally {
    closeSync(fileDescriptor);
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error(
      `${variableName} must contain exactly one 0x-prefixed 32-byte private key`,
    );
  }
  return privateKey;
}
