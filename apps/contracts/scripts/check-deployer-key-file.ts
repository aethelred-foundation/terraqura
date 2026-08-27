import { Wallet } from "ethers";

import { readDeploymentSignerKeyFile } from "./lib/deployment-signer";

const key = readDeploymentSignerKeyFile();
console.log(
  "Deployment signer key file is configured, readable, format-valid, and mode-restricted. The secret value was not printed.",
);
console.log(`Derived signer address: ${new Wallet(key).address}`);
