import { readFileSync } from "node:fs";

import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config({ path: "../../.env.local" });

function readDeploymentKey(): string | undefined {
  const keyFile = process.env.DEPLOYER_SIGNER_KEY_FILE?.trim();
  const key = keyFile
    ? readFileSync(keyFile, "utf8").trim()
    : process.env.PRIVATE_KEY?.trim();
  if (key && !/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error("Deployment signer secret is not a valid private key");
  }
  return key;
}

const deploymentKey = readDeploymentKey();
const testnetRpcUrl =
  process.env.AETHELRED_TESTNET_RPC_URL?.trim() || "http://127.0.0.1:8545";
const testnetChainId = Number.parseInt(
  process.env.AETHELRED_TESTNET_CHAIN_ID || "7332",
  10,
);
const explorerApiUrl = process.env.AETHELRED_TESTNET_EXPLORER_API?.trim() || "";
const explorerBrowserUrl =
  process.env.AETHELRED_TESTNET_EXPLORER_URL?.trim() || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    aethelredTestnet: {
      url: testnetRpcUrl,
      accounts: deploymentKey ? [deploymentKey] : [],
      chainId: testnetChainId,
      timeout: 120_000,
    },
  },
  etherscan:
    explorerApiUrl && explorerBrowserUrl
      ? {
          apiKey: {
            aethelredTestnet:
              process.env.AETHELRED_EXPLORER_API_KEY || "block-explorer",
          },
          customChains: [
            {
              network: "aethelredTestnet",
              chainId: testnetChainId,
              urls: {
                apiURL: explorerApiUrl,
                browserURL: explorerBrowserUrl,
              },
            },
          ],
        }
      : undefined,
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
