import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { stringifyPortableNetworkManifest } from "./index.js";

const packageRoot = process.cwd();
const manifestPath = resolve(packageRoot, "manifest.json");

writeFileSync(manifestPath, stringifyPortableNetworkManifest(), "utf8");

console.log(`Wrote TerraQura portable network manifest to ${manifestPath}.`);
