import { expect } from "chai";
import { resolve } from "node:path";

import {
  assertSupportedRuntime,
  REVIEWED_NODE_VERSION,
  REVIEWED_PNPM_VERSION,
} from "../scripts/lib/runtime-preflight";

const repositoryRoot = resolve(__dirname, "../../..");
const runtime = (nodeVersion: string, pnpmVersion: string): void =>
  assertSupportedRuntime({
    repositoryRoot,
    nodeVersion,
    packageManagerUserAgent: `pnpm/${pnpmVersion} npm/? node/v${nodeVersion}`,
  });

describe("deployment runtime preflight", function () {
  it("accepts the repository's reviewed Node and pnpm pins", function () {
    expect(() =>
      runtime(REVIEWED_NODE_VERSION, REVIEWED_PNPM_VERSION),
    ).not.to.throw();
  });

  it("rejects a newer Node major instead of weakening the release gate", function () {
    expect(() => runtime("25.5.0", REVIEWED_PNPM_VERSION)).to.throw(
      "requires reviewed patch 20.18.3",
    );
  });

  it("rejects drift outside Node 20.18.x and the reviewed patch", function () {
    expect(() => runtime("20.19.0", REVIEWED_PNPM_VERSION)).to.throw(
      "requires reviewed patch 20.18.3",
    );
  });

  it("rejects package-manager drift", function () {
    expect(() => runtime(REVIEWED_NODE_VERSION, "9.1.0")).to.throw(
      "pnpm 9.0.0 is required",
    );
  });
});
