import assert from "node:assert/strict";

import {
  LEGACY_VALIDATION_OPT_IN_ENV,
  getActiveDeploymentKey,
  getActiveNetworkKey,
} from "../dist/index.mjs";

assert.equal(getActiveNetworkKey({ NODE_ENV: "production" }), "aethelred");
assert.equal(getActiveNetworkKey({ NODE_ENV: "test" }), "aethelredTestnet");
assert.equal(
  getActiveNetworkKey({
    TERRAQURA_NETWORK: "polygonAmoy",
    [LEGACY_VALIDATION_OPT_IN_ENV]: "true",
  }),
  "polygonAmoy",
);
assert.equal(
  getActiveDeploymentKey({
    TERRAQURA_DEPLOYMENT: "polygonAmoyV3Final",
    NEXT_PUBLIC_TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT: "true",
  }),
  "polygonAmoyV3Final",
);

assert.throws(
  () => getActiveNetworkKey({ TERRAQURA_NETWORK: "polygonAmoy" }),
  /legacy validation evidence/,
);
assert.throws(
  () => getActiveDeploymentKey({ TERRAQURA_DEPLOYMENT: "polygonAmoyV3Final" }),
  /legacy validation evidence/,
);

console.log("TerraQura network manifest runtime guard tests passed.");
