import { FastifyInstance, FastifyPluginOptions } from "fastify";

import { readState } from "../../lib/state-store.js";

interface CreditsState {
  credits: Record<
    string,
    {
      id: string;
      currentOwnerId: string | null;
      currentOwnerWallet: string | null;
      co2CapturedKg: number;
      creditsIssued: number;
      initialCreditsIssued?: number;
      retiredAmount?: number;
      isRetired: boolean;
      retiredAt: string | null;
      createdAt: string;
    }
  >;
}

interface MarketplaceState {
  listings: Record<
    string,
    {
      pricePerUnit: string;
      remainingAmount: number;
      status: string;
    }
  >;
  purchases: Array<{
    buyerId: string;
    buyerWallet: string;
    sellerId: string;
    amount: number;
    pricePerUnit: string;
    totalPrice: string;
    purchasedAt: string;
  }>;
}

const CREDITS_STORE_KEY = "credits:v1";
const DEFAULT_CREDITS_STATE: CreditsState = {
  credits: {},
};
const MARKETPLACE_STORE_KEY = "marketplace:v1";
const DEFAULT_MARKETPLACE_STATE: MarketplaceState = {
  listings: {},
  purchases: [],
};

function getAuthenticatedUserId(request: { user?: unknown }): string | null {
  const user = request.user as { address?: string } | undefined;
  return typeof user?.address === "string"
    ? `user_${user.address.toLowerCase().slice(2, 10)}`
    : null;
}

function weiToUsd(wei: string): number {
  const maticUsd = Number.parseFloat(process.env.MATIC_USD_PRICE || "0.5");
  const matic = Number(wei) / 1e18;
  return Number.isFinite(matic) ? matic * maticUsd : 0;
}

export async function analyticsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // GET /v1/analytics/portfolio — User portfolio metrics
  fastify.get(
    "/portfolio",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Get user portfolio metrics",
        description:
          "Returns portfolio analytics for the authenticated user including total credits, retired credits, and average purchase price",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  totalCreditsOwned: { type: "number" },
                  totalCreditsRetired: { type: "number" },
                  totalCo2OffsetKg: { type: "number" },
                  totalCo2OffsetTonnes: { type: "number" },
                  avgPurchasePriceWei: { type: "string" },
                  avgPurchasePriceUsd: { type: "number" },
                  totalSpentWei: { type: "string" },
                  totalSpentUsd: { type: "number" },
                  totalTransactions: { type: "integer" },
                  portfolioBreakdown: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        creditId: { type: "string" },
                        creditsHeld: { type: "number" },
                        co2CapturedKg: { type: "number" },
                        isRetired: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = getAuthenticatedUserId(request);
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const creditsState = await readState(
        CREDITS_STORE_KEY,
        DEFAULT_CREDITS_STATE
      );
      const marketState = await readState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE
      );

      const ownedCredits = Object.values(creditsState.credits).filter(
        (credit) => credit.currentOwnerId === userId
      );

      const totalCreditsOwned = ownedCredits.reduce(
        (sum, credit) => sum + credit.creditsIssued,
        0
      );

      const totalCreditsRetired = ownedCredits.reduce(
        (sum, credit) => sum + (credit.retiredAmount ?? 0),
        0
      );

      const totalCo2OffsetKg = ownedCredits
        .filter((credit) => credit.isRetired)
        .reduce((sum, credit) => sum + credit.co2CapturedKg, 0);

      const userPurchases = marketState.purchases.filter(
        (purchase) => purchase.buyerId === userId
      );

      const totalSpentBigInt = userPurchases.reduce(
        (sum, purchase) => sum + BigInt(purchase.totalPrice),
        BigInt(0)
      );
      const totalSpentWei = totalSpentBigInt.toString();
      const totalCreditsPurchased = userPurchases.reduce(
        (sum, purchase) => sum + purchase.amount,
        0
      );

      const avgPurchasePriceWei =
        totalCreditsPurchased > 0
          ? (totalSpentBigInt / BigInt(totalCreditsPurchased)).toString()
          : "0";

      const portfolioBreakdown = ownedCredits.map((credit) => ({
        creditId: credit.id,
        creditsHeld: credit.creditsIssued,
        co2CapturedKg: credit.co2CapturedKg,
        isRetired: credit.isRetired,
      }));

      return {
        success: true,
        data: {
          userId,
          totalCreditsOwned,
          totalCreditsRetired,
          totalCo2OffsetKg,
          totalCo2OffsetTonnes: totalCo2OffsetKg / 1000,
          avgPurchasePriceWei,
          avgPurchasePriceUsd: weiToUsd(avgPurchasePriceWei),
          totalSpentWei,
          totalSpentUsd: weiToUsd(totalSpentWei),
          totalTransactions: userPurchases.length,
          portfolioBreakdown,
        },
      };
    }
  );

  // GET /v1/analytics/protocol — Protocol-wide metrics
  fastify.get(
    "/protocol",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Get protocol-wide metrics",
        description:
          "Returns aggregate protocol metrics including TVL, total retired credits, active users, and trading volume",
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  totalValueLockedWei: { type: "string" },
                  totalValueLockedUsd: { type: "number" },
                  totalCreditsMinted: { type: "number" },
                  totalCreditsRetired: { type: "number" },
                  totalCreditsTraded: { type: "number" },
                  totalTradingVolumeWei: { type: "string" },
                  totalTradingVolumeUsd: { type: "number" },
                  activeListings: { type: "integer" },
                  totalListingsCreated: { type: "integer" },
                  totalTransactions: { type: "integer" },
                  uniqueBuyers: { type: "integer" },
                  uniqueSellers: { type: "integer" },
                  activeUsers: { type: "integer" },
                  protocolFeeCollectedWei: { type: "string" },
                  protocolFeeCollectedUsd: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      const creditsState = await readState(
        CREDITS_STORE_KEY,
        DEFAULT_CREDITS_STATE
      );
      const marketState = await readState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE
      );

      const creditValues = Object.values(creditsState.credits);
      const totalCreditsMinted = creditValues.reduce(
        (sum, credit) =>
          sum + (credit.initialCreditsIssued ?? credit.creditsIssued),
        0
      );
      const totalCreditsRetired = creditValues.reduce(
        (sum, credit) => sum + (credit.retiredAmount ?? 0),
        0
      );

      const activeListings = Object.values(marketState.listings).filter(
        (listing) => listing.status === "active"
      );

      const tvlBigInt = activeListings.reduce(
        (sum, listing) =>
          sum + BigInt(listing.pricePerUnit) * BigInt(listing.remainingAmount),
        BigInt(0)
      );

      const totalTradingVolumeBigInt = marketState.purchases.reduce(
        (sum, purchase) => sum + BigInt(purchase.totalPrice),
        BigInt(0)
      );

      const totalCreditsTraded = marketState.purchases.reduce(
        (sum, purchase) => sum + purchase.amount,
        0
      );

      const protocolFeeCollected = (
        (totalTradingVolumeBigInt * BigInt(250)) /
        BigInt(10000)
      ).toString();

      const buyerSet = new Set(
        marketState.purchases.map((purchase) => purchase.buyerId)
      );
      const sellerSet = new Set(
        marketState.purchases.map((purchase) => purchase.sellerId)
      );
      const allUsers = new Set([...buyerSet, ...sellerSet]);

      return {
        success: true,
        data: {
          totalValueLockedWei: tvlBigInt.toString(),
          totalValueLockedUsd: weiToUsd(tvlBigInt.toString()),
          totalCreditsMinted,
          totalCreditsRetired,
          totalCreditsTraded,
          totalTradingVolumeWei: totalTradingVolumeBigInt.toString(),
          totalTradingVolumeUsd: weiToUsd(totalTradingVolumeBigInt.toString()),
          activeListings: activeListings.length,
          totalListingsCreated: Object.keys(marketState.listings).length,
          totalTransactions: marketState.purchases.length,
          uniqueBuyers: buyerSet.size,
          uniqueSellers: sellerSet.size,
          activeUsers: allUsers.size,
          protocolFeeCollectedWei: protocolFeeCollected,
          protocolFeeCollectedUsd: weiToUsd(protocolFeeCollected),
        },
      };
    }
  );

  // GET /v1/analytics/carbon-price — Historical carbon credit pricing
  fastify.get(
    "/carbon-price",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Get historical carbon credit pricing",
        description:
          "Returns historical carbon credit price data points based on marketplace transactions",
        querystring: {
          type: "object",
          properties: {
            interval: {
              type: "string",
              enum: ["1h", "6h", "1d", "7d", "30d"],
              default: "1d",
            },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  interval: { type: "string" },
                  currentPriceWei: { type: "string" },
                  currentPriceUsd: { type: "number" },
                  priceChange24hPercent: { type: "number" },
                  priceChange7dPercent: { type: "number" },
                  allTimeHighWei: { type: "string" },
                  allTimeHighUsd: { type: "number" },
                  allTimeLowWei: { type: "string" },
                  allTimeLowUsd: { type: "number" },
                  dataPoints: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        timestamp: { type: "string" },
                        avgPriceWei: { type: "string" },
                        avgPriceUsd: { type: "number" },
                        volume: { type: "number" },
                        transactions: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const query = request.query as {
        interval?: string;
        startDate?: string;
        endDate?: string;
      };

      const marketState = await readState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE
      );

      const intervalMs: Record<string, number> = {
        "1h": 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "1d": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      };

      const interval = query.interval || "1d";
      const bucketMs = intervalMs[interval] ?? intervalMs["1d"]!;

      const now = Date.now();
      const endDate = query.endDate ? new Date(query.endDate).getTime() : now;
      const startDate = query.startDate
        ? new Date(query.startDate).getTime()
        : endDate - 30 * 24 * 60 * 60 * 1000;

      const purchases = marketState.purchases
        .filter((purchase) => {
          const ts = new Date(purchase.purchasedAt).getTime();
          return ts >= startDate && ts <= endDate;
        })
        .sort(
          (a, b) =>
            new Date(a.purchasedAt).getTime() -
            new Date(b.purchasedAt).getTime()
        );

      // Group purchases into time buckets
      const buckets = new Map<
        number,
        { totalPrice: bigint; totalAmount: number; count: number }
      >();

      for (const purchase of purchases) {
        const ts = new Date(purchase.purchasedAt).getTime();
        const bucketKey = Math.floor(ts / bucketMs) * bucketMs;
        const existing = buckets.get(bucketKey) || {
          totalPrice: BigInt(0),
          totalAmount: 0,
          count: 0,
        };
        existing.totalPrice += BigInt(purchase.pricePerUnit);
        existing.totalAmount += purchase.amount;
        existing.count += 1;
        buckets.set(bucketKey, existing);
      }

      const dataPoints = Array.from(buckets.entries())
        .sort(([a], [b]) => a - b)
        .map(([timestamp, bucket]) => {
          const avgPriceWei =
            bucket.count > 0
              ? (bucket.totalPrice / BigInt(bucket.count)).toString()
              : "0";
          return {
            timestamp: new Date(timestamp).toISOString(),
            avgPriceWei,
            avgPriceUsd: weiToUsd(avgPriceWei),
            volume: bucket.totalAmount,
            transactions: bucket.count,
          };
        });

      // Calculate current price from the most recent purchase
      const allPurchasesSorted = [...marketState.purchases].sort(
        (a, b) =>
          new Date(b.purchasedAt).getTime() -
          new Date(a.purchasedAt).getTime()
      );
      const currentPriceWei =
        allPurchasesSorted.length > 0
          ? allPurchasesSorted[0]!.pricePerUnit
          : "0";

      // Calculate all-time high/low
      const allPrices = marketState.purchases.map((purchase) =>
        BigInt(purchase.pricePerUnit)
      );
      const allTimeHighWei =
        allPrices.length > 0
          ? allPrices
              .reduce((max, price) => (price > max ? price : max))
              .toString()
          : "0";
      const allTimeLowWei =
        allPrices.length > 0
          ? allPrices
              .reduce((min, price) => (price < min ? price : min))
              .toString()
          : "0";

      // 24h price change
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      const recentPurchases = allPurchasesSorted.filter(
        (purchase) => new Date(purchase.purchasedAt).getTime() > oneDayAgo
      );
      const olderPurchases = allPurchasesSorted.filter((purchase) => {
        const ts = new Date(purchase.purchasedAt).getTime();
        return ts <= oneDayAgo && ts > oneDayAgo - 24 * 60 * 60 * 1000;
      });

      const avgRecent =
        recentPurchases.length > 0
          ? Number(
              recentPurchases.reduce(
                (sum, purchase) => sum + BigInt(purchase.pricePerUnit),
                BigInt(0)
              ) / BigInt(recentPurchases.length)
            )
          : 0;
      const avgOlder =
        olderPurchases.length > 0
          ? Number(
              olderPurchases.reduce(
                (sum, purchase) => sum + BigInt(purchase.pricePerUnit),
                BigInt(0)
              ) / BigInt(olderPurchases.length)
            )
          : 0;

      const priceChange24hPercent =
        avgOlder > 0 ? ((avgRecent - avgOlder) / avgOlder) * 100 : 0;

      const purchases7dRecent = allPurchasesSorted.filter(
        (purchase) => new Date(purchase.purchasedAt).getTime() > sevenDaysAgo
      );
      const purchases7dOlder = allPurchasesSorted.filter((purchase) => {
        const ts = new Date(purchase.purchasedAt).getTime();
        return (
          ts <= sevenDaysAgo && ts > sevenDaysAgo - 7 * 24 * 60 * 60 * 1000
        );
      });

      const avg7dRecent =
        purchases7dRecent.length > 0
          ? Number(
              purchases7dRecent.reduce(
                (sum, purchase) => sum + BigInt(purchase.pricePerUnit),
                BigInt(0)
              ) / BigInt(purchases7dRecent.length)
            )
          : 0;
      const avg7dOlder =
        purchases7dOlder.length > 0
          ? Number(
              purchases7dOlder.reduce(
                (sum, purchase) => sum + BigInt(purchase.pricePerUnit),
                BigInt(0)
              ) / BigInt(purchases7dOlder.length)
            )
          : 0;

      const priceChange7dPercent =
        avg7dOlder > 0 ? ((avg7dRecent - avg7dOlder) / avg7dOlder) * 100 : 0;

      return {
        success: true,
        data: {
          interval,
          currentPriceWei,
          currentPriceUsd: weiToUsd(currentPriceWei),
          priceChange24hPercent: Math.round(priceChange24hPercent * 100) / 100,
          priceChange7dPercent: Math.round(priceChange7dPercent * 100) / 100,
          allTimeHighWei,
          allTimeHighUsd: weiToUsd(allTimeHighWei),
          allTimeLowWei,
          allTimeLowUsd: weiToUsd(allTimeLowWei),
          dataPoints,
        },
      };
    }
  );

  // GET /v1/analytics/leaderboard — Top offsetters leaderboard
  fastify.get(
    "/leaderboard",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Get top offsetters leaderboard",
        description:
          "Returns a ranked list of users by total carbon credits retired",
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", default: 25 },
            period: {
              type: "string",
              enum: ["all", "30d", "7d", "24h"],
              default: "all",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  period: { type: "string" },
                  leaderboard: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        rank: { type: "integer" },
                        userId: { type: "string" },
                        wallet: { type: "string", nullable: true },
                        totalRetired: { type: "number" },
                        totalCo2OffsetKg: { type: "number" },
                        creditsOwned: { type: "number" },
                      },
                    },
                  },
                  totalParticipants: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const query = request.query as {
        limit?: number;
        period?: string;
      };

      const creditsState = await readState(
        CREDITS_STORE_KEY,
        DEFAULT_CREDITS_STATE
      );

      const period = query.period || "all";
      const now = Date.now();
      const periodMs: Record<string, number> = {
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
      };

      const creditValues = Object.values(creditsState.credits);

      // Aggregate by owner
      const userMap = new Map<
        string,
        {
          userId: string;
          wallet: string | null;
          totalRetired: number;
          totalCo2OffsetKg: number;
          creditsOwned: number;
        }
      >();

      for (const credit of creditValues) {
        if (!credit.currentOwnerId) {
          continue;
        }

        // Period filter for retirements
        if (period !== "all" && credit.retiredAt) {
          const retiredTime = new Date(credit.retiredAt).getTime();
          const cutoff = now - (periodMs[period] || 0);
          if (retiredTime < cutoff) {
            continue;
          }
        }

        const existing = userMap.get(credit.currentOwnerId) || {
          userId: credit.currentOwnerId,
          wallet: credit.currentOwnerWallet,
          totalRetired: 0,
          totalCo2OffsetKg: 0,
          creditsOwned: 0,
        };

        existing.totalRetired += credit.retiredAmount ?? 0;
        existing.creditsOwned += credit.creditsIssued;
        if (credit.isRetired) {
          existing.totalCo2OffsetKg += credit.co2CapturedKg;
        }

        userMap.set(credit.currentOwnerId, existing);
      }

      const sorted = Array.from(userMap.values())
        .filter((user) => user.totalRetired > 0)
        .sort((a, b) => b.totalRetired - a.totalRetired);

      const limit = query.limit || 25;
      const leaderboard = sorted.slice(0, limit).map((user, index) => ({
        rank: index + 1,
        userId: user.userId,
        wallet: user.wallet,
        totalRetired: user.totalRetired,
        totalCo2OffsetKg: user.totalCo2OffsetKg,
        creditsOwned: user.creditsOwned,
      }));

      return {
        success: true,
        data: {
          period,
          leaderboard,
          totalParticipants: sorted.length,
        },
      };
    }
  );

  // GET /v1/analytics/impact — Environmental impact metrics
  fastify.get(
    "/impact",
    {
      schema: {
        tags: ["Analytics"],
        summary: "Get environmental impact metrics",
        description:
          "Returns aggregated environmental impact data including total CO2 captured, equivalencies (trees planted, miles driven), and protocol contribution metrics",
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  totalCo2CapturedKg: { type: "number" },
                  totalCo2CapturedTonnes: { type: "number" },
                  totalCo2RetiredKg: { type: "number" },
                  totalCo2RetiredTonnes: { type: "number" },
                  totalCreditsIssued: { type: "number" },
                  totalCreditsRetired: { type: "number" },
                  equivalencies: {
                    type: "object",
                    properties: {
                      treesPlantedEquivalent: { type: "number" },
                      milesNotDrivenEquivalent: { type: "number" },
                      homesEnergyForYear: { type: "number" },
                      flightsLAToNY: { type: "number" },
                      smartphonesCharged: { type: "number" },
                    },
                  },
                  monthlyTrend: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        month: { type: "string" },
                        co2CapturedKg: { type: "number" },
                        creditsIssued: { type: "number" },
                        creditsRetired: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      const creditsState = await readState(
        CREDITS_STORE_KEY,
        DEFAULT_CREDITS_STATE
      );

      const creditValues = Object.values(creditsState.credits);

      const totalCo2CapturedKg = creditValues.reduce(
        (sum, credit) => sum + credit.co2CapturedKg,
        0
      );
      const totalCo2RetiredKg = creditValues
        .filter((credit) => credit.isRetired)
        .reduce((sum, credit) => sum + credit.co2CapturedKg, 0);
      const totalCreditsIssued = creditValues.reduce(
        (sum, credit) =>
          sum + (credit.initialCreditsIssued ?? credit.creditsIssued),
        0
      );
      const totalCreditsRetired = creditValues.reduce(
        (sum, credit) => sum + (credit.retiredAmount ?? 0),
        0
      );

      const totalCo2RetiredTonnes = totalCo2RetiredKg / 1000;

      // EPA equivalency factors (approximate)
      // 1 tonne CO2 ~ 16.5 trees planted (grown for 10 years)
      // 1 tonne CO2 ~ 2,485 miles not driven
      // 1 tonne CO2 ~ 0.12 homes' energy for a year
      // 1 LA-NY flight ~ 0.9 tonnes CO2
      // 1 tonne CO2 ~ 121,643 smartphones charged
      const equivalencies = {
        treesPlantedEquivalent: Math.round(totalCo2RetiredTonnes * 16.5),
        milesNotDrivenEquivalent: Math.round(totalCo2RetiredTonnes * 2485),
        homesEnergyForYear:
          Math.round(totalCo2RetiredTonnes * 0.12 * 100) / 100,
        flightsLAToNY: Math.round(totalCo2RetiredTonnes / 0.9),
        smartphonesCharged: Math.round(totalCo2RetiredTonnes * 121643),
      };

      // Build monthly trend from credit creation dates
      const monthlyMap = new Map<
        string,
        {
          co2CapturedKg: number;
          creditsIssued: number;
          creditsRetired: number;
        }
      >();

      for (const credit of creditValues) {
        const monthKey = credit.createdAt.slice(0, 7); // YYYY-MM
        const existing = monthlyMap.get(monthKey) || {
          co2CapturedKg: 0,
          creditsIssued: 0,
          creditsRetired: 0,
        };
        existing.co2CapturedKg += credit.co2CapturedKg;
        existing.creditsIssued +=
          credit.initialCreditsIssued ?? credit.creditsIssued;
        existing.creditsRetired += credit.retiredAmount ?? 0;
        monthlyMap.set(monthKey, existing);
      }

      const monthlyTrend = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          co2CapturedKg: data.co2CapturedKg,
          creditsIssued: data.creditsIssued,
          creditsRetired: data.creditsRetired,
        }));

      return {
        success: true,
        data: {
          totalCo2CapturedKg,
          totalCo2CapturedTonnes: totalCo2CapturedKg / 1000,
          totalCo2RetiredKg,
          totalCo2RetiredTonnes,
          totalCreditsIssued,
          totalCreditsRetired,
          equivalencies,
          monthlyTrend,
        },
      };
    }
  );
}
