// TerraQura OpenZeppelin Defender Configuration
// Enterprise-grade contract monitoring and automation

export interface DefenderConfig {
  monitors: MonitorConfig[];
  autotasks: AutotaskConfig[];
  sentinels: SentinelConfig[];
  relayers: RelayerConfig[];
}

export interface MonitorConfig {
  name: string;
  network: string;
  addresses: string[];
  abi?: string;
  eventConditions?: EventCondition[];
  functionConditions?: FunctionCondition[];
  alertThreshold?: AlertThreshold;
  notificationChannels: string[];
}

export interface EventCondition {
  eventSignature: string;
  expression?: string;
}

export interface FunctionCondition {
  functionSignature: string;
  expression?: string;
}

export interface AlertThreshold {
  amount?: number;
  timeWindowSeconds?: number;
  comparator?: ">" | "<" | ">=" | "<=" | "==";
}

export interface AutotaskConfig {
  name: string;
  trigger: "schedule" | "webhook" | "sentinel";
  schedule?: string; // cron expression
  code: string;
  relayerId?: string;
}

export interface SentinelConfig {
  name: string;
  network: string;
  addresses: string[];
  conditions: {
    event?: EventCondition[];
    function?: FunctionCondition[];
    transaction?: TransactionCondition;
  };
  autotaskTrigger?: string;
  notificationChannels: string[];
  riskCategory: "HIGH" | "MEDIUM" | "LOW";
}

export interface TransactionCondition {
  status?: "success" | "failed";
  value?: string;
}

export interface RelayerConfig {
  name: string;
  network: string;
  minBalance: string;
  policies?: {
    gasPriceCap?: string;
    whitelistedReceivers?: string[];
  };
}

// ============================================
// TERRAQURA DEFENDER CONFIGURATION
// ============================================

export const defenderConfig: DefenderConfig = {
  // ============================================
  // MONITORS
  // ============================================
  monitors: [
    // Large Credit Mints
    {
      name: "Large Carbon Credit Mints",
      network: "aethelredTestnet",
      addresses: ["${CARBON_CREDIT_CONTRACT}"],
      eventConditions: [
        {
          eventSignature: "CreditMinted(uint256,address,uint256,uint256,bytes32,uint256)",
          expression: "amount > 1000000000000000000000", // > 1000 tonnes
        },
      ],
      alertThreshold: {
        amount: 1,
        timeWindowSeconds: 3600,
      },
      notificationChannels: ["slack-alerts", "email-compliance"],
    },

    // Large Marketplace Transactions
    {
      name: "Large Marketplace Transactions",
      network: "aethelredTestnet",
      addresses: ["${CARBON_MARKETPLACE_CONTRACT}"],
      eventConditions: [
        {
          eventSignature: "ListingPurchased(uint256,address,uint256,uint256)",
          expression: "totalPrice > 100000000000", // > $100,000 USDC
        },
      ],
      notificationChannels: ["slack-alerts", "email-treasury"],
    },

    // Verification Failures
    {
      name: "Verification Failures",
      network: "aethelredTestnet",
      addresses: ["${VERIFICATION_ENGINE_CONTRACT}"],
      eventConditions: [
        {
          eventSignature: "VerificationCompleted(bytes32,bool,uint256)",
          expression: "passed == false",
        },
      ],
      alertThreshold: {
        amount: 5,
        timeWindowSeconds: 3600,
        comparator: ">=",
      },
      notificationChannels: ["slack-alerts", "email-operations"],
    },

    // Contract Paused
    {
      name: "Contract Paused",
      network: "aethelredTestnet",
      addresses: [
        "${CARBON_CREDIT_CONTRACT}",
        "${CARBON_MARKETPLACE_CONTRACT}",
        "${VERIFICATION_ENGINE_CONTRACT}",
      ],
      eventConditions: [
        {
          eventSignature: "Paused(address)",
        },
      ],
      notificationChannels: ["slack-critical", "pagerduty", "email-all"],
    },

    // Role Changes
    {
      name: "Access Control Changes",
      network: "aethelredTestnet",
      addresses: ["${ACCESS_CONTROL_CONTRACT}"],
      eventConditions: [
        {
          eventSignature: "RoleGranted(bytes32,address,address)",
        },
        {
          eventSignature: "RoleRevoked(bytes32,address,address)",
        },
      ],
      notificationChannels: ["slack-security", "email-security"],
    },

    // KYC Status Changes
    {
      name: "KYC Status Updates",
      network: "aethelredTestnet",
      addresses: ["${ACCESS_CONTROL_CONTRACT}"],
      eventConditions: [
        {
          eventSignature: "KycStatusUpdated(address,uint8,string,uint256)",
        },
      ],
      notificationChannels: ["slack-compliance"],
    },

    // Upgrade Events
    {
      name: "Contract Upgrades",
      network: "aethelredTestnet",
      addresses: [
        "${CARBON_CREDIT_CONTRACT}",
        "${CARBON_MARKETPLACE_CONTRACT}",
        "${VERIFICATION_ENGINE_CONTRACT}",
        "${ACCESS_CONTROL_CONTRACT}",
      ],
      eventConditions: [
        {
          eventSignature: "Upgraded(address)",
        },
      ],
      notificationChannels: ["slack-critical", "pagerduty", "email-all"],
    },
  ],

  // ============================================
  // AUTOTASKS
  // ============================================
  autotasks: [
    // Expire Old Listings
    {
      name: "Expire Old Listings",
      trigger: "schedule",
      schedule: "0 */6 * * *", // Every 6 hours
      code: `
        const { ethers } = require('ethers');
        const { DefenderRelayProvider, DefenderRelaySigner } = require('defender-relay-client/lib/ethers');

        exports.handler = async function(credentials) {
          const provider = new DefenderRelayProvider(credentials);
          const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });

          const marketplace = new ethers.Contract(
            process.env.CARBON_MARKETPLACE_CONTRACT,
            ['function expireListings(uint256[] calldata listingIds) external'],
            signer
          );

          // Get expired listings from subgraph
          const response = await fetch(process.env.SUBGRAPH_URL, {
            method: 'POST',
            body: JSON.stringify({
              query: \`{
                listings(where: { status: "ACTIVE", expiresAt_lt: "\${Math.floor(Date.now() / 1000)}" }) {
                  id
                  listingId
                }
              }\`
            })
          });

          const { data } = await response.json();
          const listingIds = data.listings.map(l => l.listingId);

          if (listingIds.length > 0) {
            const tx = await marketplace.expireListings(listingIds);
            console.log('Expired', listingIds.length, 'listings. Tx:', tx.hash);
          }
        }
      `,
      relayerId: "terraqura-relayer",
    },

    // KYC Expiry Check
    {
      name: "KYC Expiry Notifications",
      trigger: "schedule",
      schedule: "0 9 * * *", // Daily at 9 AM
      code: `
        const { ethers } = require('ethers');

        exports.handler = async function(event, context) {
          const provider = new ethers.providers.JsonRpcProvider(process.env.AETHELRED_RPC_URL);

          const accessControl = new ethers.Contract(
            process.env.ACCESS_CONTROL_CONTRACT,
            ['function getKycInfo(address) view returns (uint8,uint256,uint256,string,bool,bool)'],
            provider
          );

          // Get active users from subgraph
          const response = await fetch(process.env.SUBGRAPH_URL, {
            method: 'POST',
            body: JSON.stringify({
              query: \`{
                users(where: { isKycVerified: true }) {
                  id
                }
              }\`
            })
          });

          const { data } = await response.json();
          const expiringUsers = [];
          const now = Math.floor(Date.now() / 1000);
          const thirtyDays = 30 * 24 * 60 * 60;

          for (const user of data.users) {
            const kycInfo = await accessControl.getKycInfo(user.id);
            const expiresAt = kycInfo[2].toNumber();

            if (expiresAt > 0 && expiresAt - now < thirtyDays) {
              expiringUsers.push({ address: user.id, expiresAt });
            }
          }

          if (expiringUsers.length > 0) {
            // Send notification
            await context.notify({
              channel: 'slack-compliance',
              message: \`KYC expiring soon for \${expiringUsers.length} users\`,
              users: expiringUsers
            });
          }
        }
      `,
    },

    // Health Check
    {
      name: "System Health Check",
      trigger: "schedule",
      schedule: "*/5 * * * *", // Every 5 minutes
      code: `
        const { ethers } = require('ethers');

        exports.handler = async function(event, context) {
          const provider = new ethers.providers.JsonRpcProvider(process.env.AETHELRED_RPC_URL);

          const contracts = [
            { name: 'CarbonCredit', address: process.env.CARBON_CREDIT_CONTRACT },
            { name: 'Marketplace', address: process.env.CARBON_MARKETPLACE_CONTRACT },
            { name: 'VerificationEngine', address: process.env.VERIFICATION_ENGINE_CONTRACT },
          ];

          const pausableAbi = ['function paused() view returns (bool)'];

          for (const contract of contracts) {
            try {
              const c = new ethers.Contract(contract.address, pausableAbi, provider);
              const isPaused = await c.paused();

              if (isPaused) {
                await context.notify({
                  channel: 'slack-critical',
                  message: \`ALERT: \${contract.name} is PAUSED!\`
                });
              }
            } catch (error) {
              await context.notify({
                channel: 'slack-critical',
                message: \`ALERT: Cannot reach \${contract.name}: \${error.message}\`
              });
            }
          }
        }
      `,
    },
  ],

  // ============================================
  // SENTINELS
  // ============================================
  sentinels: [
    // High-Risk: Large Retirements
    {
      name: "Large Retirement Sentinel",
      network: "aethelredTestnet",
      addresses: ["${CARBON_CREDIT_CONTRACT}"],
      conditions: {
        event: [
          {
            eventSignature: "CreditRetired(uint256,address,uint256,string)",
            expression: "amount > 10000000000000000000000", // > 10,000 tonnes
          },
        ],
      },
      notificationChannels: ["pagerduty", "slack-critical"],
      riskCategory: "HIGH",
    },

    // High-Risk: Failed Transactions
    {
      name: "Failed Transaction Sentinel",
      network: "aethelredTestnet",
      addresses: [
        "${CARBON_CREDIT_CONTRACT}",
        "${CARBON_MARKETPLACE_CONTRACT}",
      ],
      conditions: {
        transaction: {
          status: "failed",
        },
      },
      notificationChannels: ["slack-alerts"],
      riskCategory: "MEDIUM",
    },

    // Critical: Owner Changes
    {
      name: "Ownership Transfer Sentinel",
      network: "aethelredTestnet",
      addresses: [
        "${CARBON_CREDIT_CONTRACT}",
        "${CARBON_MARKETPLACE_CONTRACT}",
        "${VERIFICATION_ENGINE_CONTRACT}",
        "${ACCESS_CONTROL_CONTRACT}",
      ],
      conditions: {
        event: [
          {
            eventSignature: "OwnershipTransferred(address,address)",
          },
        ],
      },
      notificationChannels: ["pagerduty", "slack-critical", "email-security"],
      riskCategory: "HIGH",
    },
  ],

  // ============================================
  // RELAYERS
  // ============================================
  relayers: [
    {
      name: "terraqura-relayer",
      network: "aethelredTestnet",
      minBalance: "1000000000000000000", // 1 AETH
      policies: {
        gasPriceCap: "500000000000", // 500 gwei
        whitelistedReceivers: [
          "${CARBON_CREDIT_CONTRACT}",
          "${CARBON_MARKETPLACE_CONTRACT}",
          "${VERIFICATION_ENGINE_CONTRACT}",
        ],
      },
    },
  ],
};

export default defenderConfig;
