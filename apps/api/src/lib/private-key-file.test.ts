import { chmodSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readModeRestrictedPrivateKeyFile } from "./private-key-file.js";

const testKey = `0x${"1".repeat(64)}`;

function keyFile(mode = 0o400, contents = `${testKey}\n`): string {
  const directory = mkdtempSync(join(tmpdir(), "terraqura-api-signer-"));
  const path = join(directory, "operator.key");
  writeFileSync(path, contents, { mode: 0o600 });
  chmodSync(path, mode);
  return path;
}

describe("private key files", () => {
  it("reads an absolute, mode-restricted regular file", () => {
    expect(readModeRestrictedPrivateKeyFile(keyFile(), "TEST_KEY_FILE")).toBe(
      testKey,
    );
  });

  it("rejects relative paths, symlinks, broad modes, and invalid content", () => {
    expect(() =>
      readModeRestrictedPrivateKeyFile("relative.key", "TEST_KEY_FILE"),
    ).toThrow("must be an absolute path");

    const target = keyFile();
    const link = join(
      mkdtempSync(join(tmpdir(), "terraqura-api-link-")),
      "key",
    );
    symlinkSync(target, link);
    expect(() =>
      readModeRestrictedPrivateKeyFile(link, "TEST_KEY_FILE"),
    ).toThrow("must not be a symbolic link");

    expect(() =>
      readModeRestrictedPrivateKeyFile(keyFile(0o640), "TEST_KEY_FILE"),
    ).toThrow("mode 0400 or 0600");
    expect(() =>
      readModeRestrictedPrivateKeyFile(keyFile(0o500), "TEST_KEY_FILE"),
    ).toThrow("mode 0400 or 0600");
    expect(() =>
      readModeRestrictedPrivateKeyFile(
        keyFile(0o400, "not-a-key\n"),
        "TEST_KEY_FILE",
      ),
    ).toThrow("exactly one 0x-prefixed 32-byte private key");
  });
});
