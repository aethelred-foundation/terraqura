import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "solidity-docgen";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config({ path: "../../.env.local" });

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY && process.env.NODE_ENV === "production") {
  throw new Error("PRIVATE_KEY must be set for production network usage");
}

const REMOTE_ACCOUNTS = PRIVATE_KEY ? [PRIVATE_KEY] : [];

// Aethelred Network Configuration (Sovereign EVM Chain)
const AETHELRED_RPC_URL = process.env.AETHELRED_RPC_URL || "https://rpc.aethelred.network";
const AETHELRED_TESTNET_RPC_URL = process.env.AETHELRED_TESTNET_RPC_URL || "https://rpc-testnet.aethelred.network";
const AETHELRED_CHAIN_ID = parseInt(process.env.AETHELRED_CHAIN_ID || "123456");
const AETHELRED_TESTNET_CHAIN_ID = 78432;
const AETHELRED_EXPLORER_API = process.env.AETHELRED_EXPLORER_API || "https://explorer.aethelred.network/api";
const AETHELRED_EXPLORER_URL = process.env.AETHELRED_EXPLORER_URL || "https://explorer.aethelred.network";
const AETHELRED_TESTNET_EXPLORER_API = process.env.AETHELRED_TESTNET_EXPLORER_API || "https://explorer-testnet.aethelred.network/api";
const AETHELRED_TESTNET_EXPLORER_URL = process.env.AETHELRED_TESTNET_EXPLORER_URL || "https://explorer-testnet.aethelred.network";
const AETHELRED_API_KEY = process.env.AETHELRED_API_KEY || "any-string-blockscout";

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
    // ─── Aethelred Testnet ────────────────────
    // Pre-production validation network (replaces Polygon Amoy).
    aethelredTestnet: {
      url: AETHELRED_TESTNET_RPC_URL,
      accounts: REMOTE_ACCOUNTS,
      chainId: AETHELRED_TESTNET_CHAIN_ID,
      gasPrice: "auto",
    },
    // ─── Aethelred Sovereign Network ────────────────────
    // TerraQura's flagship enterprise deployment chain.
    // Uses same Solidity contracts (EVM-compatible) with sovereign
    // 1st-party oracle (NativeIoTOracle) and custom gasless relayer.
    aethelred: {
      url: AETHELRED_RPC_URL,
      accounts: REMOTE_ACCOUNTS,
      chainId: AETHELRED_CHAIN_ID,
      gasPrice: "auto",
      // Enterprise: longer timeout for Aethelred's block finality
      timeout: 120000,
    },
  },
  etherscan: {
    apiKey: {
      aethelred: AETHELRED_API_KEY,
      aethelredTestnet: AETHELRED_API_KEY,
    },
    customChains: [
      {
        network: "aethelredTestnet",
        chainId: AETHELRED_TESTNET_CHAIN_ID,
        urls: {
          apiURL: AETHELRED_TESTNET_EXPLORER_API,
          browserURL: AETHELRED_TESTNET_EXPLORER_URL,
        },
      },
      {
        network: "aethelred",
        chainId: AETHELRED_CHAIN_ID,
        urls: {
          apiURL: AETHELRED_EXPLORER_API,
          browserURL: AETHELRED_EXPLORER_URL,
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
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
  docgen: {
    outputDir: "./audit-packet/docs",
    pages: "files",
    exclude: ["mocks"],
  },
};

export default config;
