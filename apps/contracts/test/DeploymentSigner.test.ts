import { expect } from "chai";
import { chmodSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  LEGACY_PRIVATE_KEY_ERROR,
  readDeploymentSignerKeyFile,
  readDeveloperDeploymentKey,
  shouldLoadDeveloperEnv,
} from "../scripts/lib/deployment-signer";

const testKey = `0x${"1".repeat(64)}`;

function keyFile(mode = 0o400, contents = `${testKey}\n`): string {
  const directory = mkdtempSync(join(tmpdir(), "terraqura-signer-"));
  const path = join(directory, "deployer.key");
  writeFileSync(path, contents, { mode: 0o600 });
  chmodSync(path, mode);
  return path;
}

describe("deployment signer key handling", function () {
  it("accepts an absolute, mode-restricted key file", function () {
    const path = keyFile();
    expect(
      readDeploymentSignerKeyFile({ DEPLOYER_SIGNER_KEY_FILE: path }),
    ).to.equal(testKey);
  });

  it("rejects legacy PRIVATE_KEY even when a key file is configured", function () {
    const path = keyFile();
    let error: Error | undefined;
    try {
      readDeploymentSignerKeyFile({
        DEPLOYER_SIGNER_KEY_FILE: path,
        PRIVATE_KEY: testKey,
      });
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).to.equal(LEGACY_PRIVATE_KEY_ERROR);
    expect(error?.message).not.to.include(testKey);
    expect(error?.message).to.include("unset PRIVATE_KEY");
    expect(error?.message).to.include(".env.local");
  });

  it("rejects relative paths, symlinks, broad permissions, and invalid content", function () {
    expect(() =>
      readDeploymentSignerKeyFile({
        DEPLOYER_SIGNER_KEY_FILE: "relative/deployer.key",
      }),
    ).to.throw("must be an absolute path");

    const target = keyFile();
    const link = join(mkdtempSync(join(tmpdir(), "terraqura-link-")), "key");
    symlinkSync(target, link);
    expect(() =>
      readDeploymentSignerKeyFile({ DEPLOYER_SIGNER_KEY_FILE: link }),
    ).to.throw("must not be a symbolic link");

    const broad = keyFile(0o640);
    expect(() =>
      readDeploymentSignerKeyFile({ DEPLOYER_SIGNER_KEY_FILE: broad }),
    ).to.throw("mode 0400 or 0600");

    const executable = keyFile(0o500);
    expect(() =>
      readDeploymentSignerKeyFile({ DEPLOYER_SIGNER_KEY_FILE: executable }),
    ).to.throw("mode 0400 or 0600");

    const invalid = keyFile(0o400, "0xnot-a-key\n");
    expect(() =>
      readDeploymentSignerKeyFile({ DEPLOYER_SIGNER_KEY_FILE: invalid }),
    ).to.throw("exactly one 0x-prefixed 32-byte private key");
  });

  it("loads repository developer env only outside the deployment ceremony", function () {
    expect(shouldLoadDeveloperEnv({})).to.equal(true);
    expect(
      shouldLoadDeveloperEnv({ TERRAQURA_DEPLOY_PHASE: "preflight" }),
    ).to.equal(false);
  });

  it("retains the legacy key fallback only for non-ceremony developer commands", function () {
    expect(readDeveloperDeploymentKey({ PRIVATE_KEY: testKey })).to.equal(
      testKey,
    );
    expect(() =>
      readDeveloperDeploymentKey({ PRIVATE_KEY: "not-a-key" }),
    ).to.throw("not a valid private key");
  });
});
