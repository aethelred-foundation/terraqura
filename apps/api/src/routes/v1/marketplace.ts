import { randomUUID } from "node:crypto";

import { ListingStatus } from "@terraqura/types";
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { z } from "zod";

import {
  ensureApprovedKyc,
  getAuthenticatedAddress,
} from "../../lib/auth-context.js";
import {
  bearerAuthRateLimit,
  verifyBearerAuth,
} from "../../lib/bearer-auth.js";
import {
  CREDITS_STORE_KEY,
  DEFAULT_CREDITS_STATE,
  type CreditsState,
  type StoredCredit,
} from "../../lib/carbon-state.js";
import { mutateStatePair, readState } from "../../lib/state-store.js";
import {
  getExplorerTxLink,
  verifyListingCancellationOnChain,
  verifyListingOnChain,
  verifyPurchaseOnChain,
} from "../../services/blockchain/contracts.js";

const TransactionHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

const CreateListingSchema = z.object({
  tokenId: z.string().regex(/^\d+$/),
  amount: z.number().int().positive(),
  pricePerUnit: z.string().regex(/^[1-9]\d*$/),
  minPurchaseAmount: z.number().int().positive().optional(),
  durationDays: z.number().int().min(0).max(365).optional(),
  txHash: TransactionHashSchema,
});

const PurchaseSchema = z.object({
  amount: z.number().int().positive(),
  txHash: TransactionHashSchema,
});

const FinalizeCancellationSchema = z.object({
  txHash: TransactionHashSchema,
});

interface StoredListing {
  id: string;
  listingId: string;
  sellerId: string;
  sellerWallet: string;
  tokenId: string;
  creditId: string;
  dacUnitId: string;
  amount: number;
  remainingAmount: number;
  pricePerUnit: string;
  minPurchaseAmount: number;
  status: ListingStatus;
  createdAt: string;
  expiresAt: string | null;
  soldAt: string | null;
  cancelledAt: string | null;
  txHash: string;
  blockNumber: number;
  cancellationTxHash: string | null;
}

interface StoredPurchase {
  id: string;
  listingId: string;
  onChainListingId: string;
  buyerId: string;
  buyerWallet: string;
  sellerId: string;
  sellerWallet: string;
  tokenId: string;
  creditId: string;
  amount: number;
  pricePerUnit: string;
  totalPrice: string;
  platformFee: string;
  sellerProceeds: string;
  txHash: string;
  blockNumber: number;
  purchasedAt: string;
}

interface MarketplaceState {
  listings: Record<string, StoredListing>;
  purchases: StoredPurchase[];
  processedTxHashes: Record<string, string>;
}

const MARKETPLACE_STORE_KEY = "marketplace:v2";
const DEFAULT_MARKETPLACE_STATE: MarketplaceState = {
  listings: {},
  purchases: [],
  processedTxHashes: {},
};

function isExpired(dateIso: string | null): boolean {
  return dateIso ? Date.now() > new Date(dateIso).getTime() : false;
}

function getEffectiveStatus(listing: StoredListing): ListingStatus {
  if (listing.status === ListingStatus.ACTIVE && isExpired(listing.expiresAt)) {
    return ListingStatus.EXPIRED;
  }
  return listing.status;
}

function listingResponse(listing: StoredListing) {
  return {
    ...listing,
    status: getEffectiveStatus(listing),
    explorerUrl: getExplorerTxLink(listing.txHash),
  };
}

function findHolding(
  state: CreditsState,
  tokenId: string,
  ownerWallet: string,
): StoredCredit | undefined {
  return Object.values(state.credits).find(
    (credit) =>
      BigInt(credit.tokenId) === BigInt(tokenId) &&
      credit.currentOwnerWallet?.toLowerCase() === ownerWallet.toLowerCase(),
  );
}

function createBuyerHolding(
  source: StoredCredit,
  buyerWallet: string,
  amount: number,
  nowIso: string,
): StoredCredit {
  return {
    ...source,
    id: `cred_${randomUUID()}`,
    creditsIssued: amount,
    escrowedAmount: 0,
    initialCreditsIssued: 0,
    retiredAmount: 0,
    currentOwnerId: `user_${buyerWallet.slice(2, 10)}`,
    currentOwnerWallet: buyerWallet,
    isRetired: false,
    retiredAt: null,
    retirementReason: null,
    retirementTxHash: null,
    retirementTxHashes: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function requireApprovedOperator(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  const wallet = getAuthenticatedAddress(request);
  if (!wallet) {
    reply.status(401).send({
      success: false,
      error: "Missing authenticated wallet",
    });
    return null;
  }
  if (
    !ensureApprovedKyc(request, reply, {
      message: "Approved KYC is required for marketplace operations",
    })
  ) {
    return null;
  }
  return wallet;
}

export async function marketplaceRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get(
    "/listings",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Get confirmed on-chain marketplace listings",
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["active", "sold", "cancelled", "expired"],
            },
            tokenId: { type: "string", pattern: "^\\d+$" },
            sellerWallet: { type: "string" },
            sortBy: {
              type: "string",
              enum: ["price_asc", "price_desc", "newest", "oldest", "amount"],
            },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
    },
    async (request) => {
      const query = request.query as {
        status?: string;
        tokenId?: string;
        sellerWallet?: string;
        sortBy?: string;
        limit?: number;
        offset?: number;
      };
      const state = await readState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
      );
      let listings = Object.values(state.listings);

      listings = listings.filter((listing) =>
        query.status
          ? getEffectiveStatus(listing) === query.status
          : getEffectiveStatus(listing) === ListingStatus.ACTIVE,
      );
      if (query.tokenId) {
        const tokenId = query.tokenId;
        listings = listings.filter(
          (listing) => BigInt(listing.tokenId) === BigInt(tokenId),
        );
      }
      if (query.sellerWallet) {
        const sellerWallet = query.sellerWallet.toLowerCase();
        listings = listings.filter(
          (listing) => listing.sellerWallet.toLowerCase() === sellerWallet,
        );
      }

      switch (query.sortBy) {
        case "price_asc":
          listings.sort((left, right) =>
            BigInt(left.pricePerUnit) > BigInt(right.pricePerUnit) ? 1 : -1,
          );
          break;
        case "price_desc":
          listings.sort((left, right) =>
            BigInt(left.pricePerUnit) < BigInt(right.pricePerUnit) ? 1 : -1,
          );
          break;
        case "oldest":
          listings.sort(
            (left, right) =>
              new Date(left.createdAt).getTime() -
              new Date(right.createdAt).getTime(),
          );
          break;
        case "amount":
          listings.sort(
            (left, right) => right.remainingAmount - left.remainingAmount,
          );
          break;
        default:
          listings.sort(
            (left, right) =>
              new Date(right.createdAt).getTime() -
              new Date(left.createdAt).getTime(),
          );
      }

      const total = listings.length;
      const limit = Math.min(query.limit || 50, 100);
      const offset = Math.max(query.offset || 0, 0);
      return {
        success: true,
        data: listings
          .slice(offset, offset + limit)
          .map((listing) => listingResponse(listing)),
        pagination: { total, limit, offset },
      };
    },
  );

  fastify.post(
    "/listings",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Index a wallet-signed on-chain listing",
        security: [{ bearerAuth: [] }],
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const body = CreateListingSchema.parse(request.body);
      const sellerWallet = requireApprovedOperator(request, reply);
      if (!sellerWallet) return;

      let confirmed: Awaited<ReturnType<typeof verifyListingOnChain>>;
      try {
        confirmed = await verifyListingOnChain({
          txHash: body.txHash,
          seller: sellerWallet,
          tokenId: body.tokenId,
          amount: body.amount,
          pricePerUnit: body.pricePerUnit,
          minPurchaseAmount: body.minPurchaseAmount ?? 1,
          durationSeconds: (body.durationDays ?? 0) * 86_400,
        });
      } catch (error) {
        request.log.warn(
          { err: error, txHash: body.txHash },
          "Listing receipt rejected",
        );
        return reply.status(422).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Listing transaction could not be verified",
        });
      }

      const result = await mutateStatePair(
        {
          storeKey: MARKETPLACE_STORE_KEY,
          defaultState: DEFAULT_MARKETPLACE_STATE,
        },
        {
          storeKey: CREDITS_STORE_KEY,
          defaultState: DEFAULT_CREDITS_STATE,
        },
        async (market, credits) => {
          const existingId =
            market.processedTxHashes[body.txHash.toLowerCase()];
          if (existingId) {
            const existing = market.listings[existingId];
            return existing
              ? {
                  kind: "existing" as const,
                  listing: existing,
                }
              : { kind: "replayed" as const };
          }

          const sellerCredit = findHolding(credits, body.tokenId, sellerWallet);
          if (!sellerCredit) return { kind: "credit_not_found" as const };
          if (sellerCredit.creditsIssued < body.amount) {
            return { kind: "insufficient" as const };
          }

          const duplicateOnChainId = Object.values(market.listings).some(
            (listing) => listing.listingId === confirmed.listingId,
          );
          if (duplicateOnChainId) {
            return { kind: "duplicate_listing" as const };
          }

          const nowIso = new Date().toISOString();
          const id = `listing_${randomUUID()}`;
          const durationDays = body.durationDays ?? 0;
          const listing: StoredListing = {
            id,
            listingId: confirmed.listingId,
            sellerId: `user_${sellerWallet.slice(2, 10)}`,
            sellerWallet,
            tokenId: body.tokenId,
            creditId: sellerCredit.id,
            dacUnitId: sellerCredit.dacUnitId,
            amount: body.amount,
            remainingAmount: body.amount,
            pricePerUnit: body.pricePerUnit,
            minPurchaseAmount: body.minPurchaseAmount ?? 1,
            status: ListingStatus.ACTIVE,
            createdAt: nowIso,
            expiresAt:
              durationDays > 0
                ? new Date(Date.now() + durationDays * 86_400_000).toISOString()
                : null,
            soldAt: null,
            cancelledAt: null,
            txHash: confirmed.txHash,
            blockNumber: confirmed.blockNumber,
            cancellationTxHash: null,
          };

          sellerCredit.creditsIssued -= body.amount;
          sellerCredit.escrowedAmount =
            (sellerCredit.escrowedAmount ?? 0) + body.amount;
          sellerCredit.updatedAt = nowIso;
          market.listings[id] = listing;
          market.processedTxHashes[body.txHash.toLowerCase()] = id;
          return { kind: "success" as const, listing };
        },
      );

      if (result.kind === "credit_not_found") {
        return reply.status(404).send({
          success: false,
          error: "The authenticated wallet does not own this indexed credit",
        });
      }
      if (result.kind === "insufficient") {
        return reply.status(409).send({
          success: false,
          error: "Listing amount exceeds the indexed available balance",
        });
      }
      if (result.kind === "duplicate_listing") {
        return reply.status(409).send({
          success: false,
          error: "The on-chain listing is already indexed",
        });
      }
      if (result.kind === "replayed") {
        return reply.status(409).send({
          success: false,
          error: "Transaction hash was already used",
        });
      }

      return reply
        .status(result.kind === "existing" ? 200 : 201)
        .send({ success: true, data: listingResponse(result.listing) });
    },
  );

  fastify.get(
    "/listings/:id",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Get confirmed listing details",
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const state = await readState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
      );
      const listing = state.listings[id];
      if (!listing) {
        return reply.status(404).send({
          success: false,
          error: "Listing not found",
        });
      }
      return { success: true, data: listingResponse(listing) };
    },
  );

  fastify.post(
    "/listings/:id/purchase",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Index a wallet-signed on-chain purchase",
        security: [{ bearerAuth: [] }],
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = PurchaseSchema.parse(request.body);
      const buyerWallet = requireApprovedOperator(request, reply);
      if (!buyerWallet) return;

      const marketSnapshot = await readState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
      );
      const listingSnapshot = marketSnapshot.listings[id];
      if (!listingSnapshot) {
        return reply.status(404).send({
          success: false,
          error: "Listing not found",
        });
      }
      const totalPrice = (
        BigInt(listingSnapshot.pricePerUnit) * BigInt(body.amount)
      ).toString();

      let confirmed: Awaited<ReturnType<typeof verifyPurchaseOnChain>>;
      try {
        confirmed = await verifyPurchaseOnChain({
          txHash: body.txHash,
          buyer: buyerWallet,
          listingId: listingSnapshot.listingId,
          tokenId: listingSnapshot.tokenId,
          amount: body.amount,
          totalPrice,
        });
      } catch (error) {
        request.log.warn(
          { err: error, txHash: body.txHash },
          "Purchase receipt rejected",
        );
        return reply.status(422).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Purchase transaction could not be verified",
        });
      }

      const result = await mutateStatePair(
        {
          storeKey: MARKETPLACE_STORE_KEY,
          defaultState: DEFAULT_MARKETPLACE_STATE,
        },
        {
          storeKey: CREDITS_STORE_KEY,
          defaultState: DEFAULT_CREDITS_STATE,
        },
        async (market, credits) => {
          const existingId =
            market.processedTxHashes[body.txHash.toLowerCase()];
          if (existingId) {
            const existing = market.purchases.find(
              (purchase) => purchase.id === existingId,
            );
            return existing
              ? { kind: "existing" as const, purchase: existing }
              : { kind: "replayed" as const };
          }

          const listing = market.listings[id];
          if (!listing) return { kind: "not_found" as const };
          if (getEffectiveStatus(listing) !== ListingStatus.ACTIVE) {
            return { kind: "not_active" as const };
          }
          if (listing.sellerWallet.toLowerCase() === buyerWallet) {
            return { kind: "self_purchase" as const };
          }
          if (
            body.amount > listing.remainingAmount ||
            body.amount < listing.minPurchaseAmount
          ) {
            return { kind: "invalid_amount" as const };
          }
          if (confirmed.seller !== listing.sellerWallet.toLowerCase()) {
            return { kind: "seller_mismatch" as const };
          }

          const sellerCredit = credits.credits[listing.creditId];
          if (
            !sellerCredit ||
            (sellerCredit.escrowedAmount ?? 0) < body.amount
          ) {
            return { kind: "balance_mismatch" as const };
          }

          const nowIso = new Date().toISOString();
          sellerCredit.escrowedAmount -= body.amount;
          sellerCredit.updatedAt = nowIso;

          const buyerCredit = findHolding(
            credits,
            listing.tokenId,
            buyerWallet,
          );
          if (buyerCredit) {
            buyerCredit.creditsIssued += body.amount;
            buyerCredit.updatedAt = nowIso;
          } else {
            const created = createBuyerHolding(
              sellerCredit,
              buyerWallet,
              body.amount,
              nowIso,
            );
            credits.credits[created.id] = created;
          }

          listing.remainingAmount -= body.amount;
          if (listing.remainingAmount === 0) {
            listing.status = ListingStatus.SOLD;
            listing.soldAt = nowIso;
          }

          const platformFee = confirmed.platformFee;
          const purchase: StoredPurchase = {
            id: `purchase_${randomUUID()}`,
            listingId: listing.id,
            onChainListingId: listing.listingId,
            buyerId: `user_${buyerWallet.slice(2, 10)}`,
            buyerWallet,
            sellerId: listing.sellerId,
            sellerWallet: listing.sellerWallet,
            tokenId: listing.tokenId,
            creditId: listing.creditId,
            amount: body.amount,
            pricePerUnit: listing.pricePerUnit,
            totalPrice,
            platformFee,
            sellerProceeds: (
              BigInt(totalPrice) - BigInt(platformFee)
            ).toString(),
            txHash: confirmed.txHash,
            blockNumber: confirmed.blockNumber,
            purchasedAt: nowIso,
          };
          market.purchases.push(purchase);
          market.processedTxHashes[body.txHash.toLowerCase()] = purchase.id;
          return { kind: "success" as const, purchase };
        },
      );

      if (result.kind === "existing") {
        return {
          success: true,
          data: {
            ...result.purchase,
            explorerUrl: getExplorerTxLink(result.purchase.txHash),
          },
        };
      }
      if (result.kind !== "success") {
        const messages: Record<string, string> = {
          replayed: "Transaction hash was already used",
          not_found: "Listing not found",
          not_active: "Listing is not active",
          self_purchase: "Seller cannot purchase their own listing",
          invalid_amount: "Purchase amount is outside listing limits",
          seller_mismatch: "On-chain seller does not match the indexed listing",
          balance_mismatch: "Escrowed balance does not match the purchase",
        };
        return reply.status(409).send({
          success: false,
          error: messages[result.kind],
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          ...result.purchase,
          explorerUrl: getExplorerTxLink(result.purchase.txHash),
        },
      });
    },
  );

  fastify.post(
    "/listings/:id/cancel",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Index a wallet-signed on-chain listing cancellation",
        security: [{ bearerAuth: [] }],
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = FinalizeCancellationSchema.parse(request.body);
      const sellerWallet = requireApprovedOperator(request, reply);
      if (!sellerWallet) return;

      const snapshot = await readState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
      );
      const listingSnapshot = snapshot.listings[id];
      if (!listingSnapshot) {
        return reply.status(404).send({
          success: false,
          error: "Listing not found",
        });
      }
      if (
        listingSnapshot.sellerWallet.toLowerCase() !==
        sellerWallet.toLowerCase()
      ) {
        return reply.status(403).send({
          success: false,
          error: "Only the listing seller can cancel it",
        });
      }

      let confirmed: Awaited<
        ReturnType<typeof verifyListingCancellationOnChain>
      >;
      try {
        confirmed = await verifyListingCancellationOnChain({
          txHash: body.txHash,
          seller: sellerWallet,
          listingId: listingSnapshot.listingId,
        });
      } catch (error) {
        request.log.warn(
          { err: error, txHash: body.txHash },
          "Cancellation receipt rejected",
        );
        return reply.status(422).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Cancellation transaction could not be verified",
        });
      }

      const result = await mutateStatePair(
        {
          storeKey: MARKETPLACE_STORE_KEY,
          defaultState: DEFAULT_MARKETPLACE_STATE,
        },
        {
          storeKey: CREDITS_STORE_KEY,
          defaultState: DEFAULT_CREDITS_STATE,
        },
        async (market, credits) => {
          const existingId =
            market.processedTxHashes[body.txHash.toLowerCase()];
          if (existingId === id) {
            const existingListing = market.listings[id];
            if (!existingListing) {
              return { kind: "replayed" as const };
            }
            return {
              kind: "existing" as const,
              listing: existingListing,
            };
          }
          if (existingId) return { kind: "replayed" as const };

          const listing = market.listings[id];
          if (!listing) return { kind: "not_found" as const };
          if (
            listing.status !== ListingStatus.ACTIVE &&
            getEffectiveStatus(listing) !== ListingStatus.EXPIRED
          ) {
            return { kind: "not_cancellable" as const };
          }
          const sellerCredit = credits.credits[listing.creditId];
          if (
            !sellerCredit ||
            (sellerCredit.escrowedAmount ?? 0) < listing.remainingAmount
          ) {
            return { kind: "balance_mismatch" as const };
          }

          const nowIso = new Date().toISOString();
          sellerCredit.escrowedAmount -= listing.remainingAmount;
          sellerCredit.creditsIssued += listing.remainingAmount;
          sellerCredit.updatedAt = nowIso;
          listing.status = ListingStatus.CANCELLED;
          listing.cancelledAt = nowIso;
          listing.cancellationTxHash = confirmed.txHash;
          market.processedTxHashes[body.txHash.toLowerCase()] = id;
          return { kind: "success" as const, listing };
        },
      );

      if (result.kind !== "success" && result.kind !== "existing") {
        const messages: Record<string, string> = {
          replayed: "Transaction hash was already used",
          not_found: "Listing not found",
          not_cancellable: "Listing is not cancellable",
          balance_mismatch: "Escrowed balance does not match the listing",
        };
        return reply.status(409).send({
          success: false,
          error: messages[result.kind],
        });
      }
      return {
        success: true,
        data: {
          ...listingResponse(result.listing),
          cancellationExplorerUrl: getExplorerTxLink(confirmed.txHash),
        },
      };
    },
  );

  fastify.get(
    "/stats",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Get confirmed marketplace statistics",
      },
    },
    async () => {
      const [market, credits] = await Promise.all([
        readState(MARKETPLACE_STORE_KEY, DEFAULT_MARKETPLACE_STATE),
        readState(CREDITS_STORE_KEY, DEFAULT_CREDITS_STATE),
      ]);
      const now = Date.now();
      const oneDayAgo = now - 86_400_000;
      const sevenDaysAgo = now - 7 * 86_400_000;
      const purchases24h = market.purchases.filter(
        (purchase) => new Date(purchase.purchasedAt).getTime() > oneDayAgo,
      );
      const purchases7d = market.purchases.filter(
        (purchase) => new Date(purchase.purchasedAt).getTime() > sevenDaysAgo,
      );
      const activeListings = Object.values(market.listings).filter(
        (listing) => getEffectiveStatus(listing) === ListingStatus.ACTIVE,
      );
      const volume = (purchases: StoredPurchase[]) =>
        purchases
          .reduce((sum, purchase) => sum + BigInt(purchase.totalPrice), 0n)
          .toString();
      const floorPrice =
        activeListings.length > 0
          ? activeListings.reduce((minimum, listing) =>
              BigInt(listing.pricePerUnit) < BigInt(minimum.pricePerUnit)
                ? listing
                : minimum,
            ).pricePerUnit
          : "0";
      const avgPrice24h =
        purchases24h.length > 0
          ? (
              purchases24h.reduce(
                (sum, purchase) => sum + BigInt(purchase.pricePerUnit),
                0n,
              ) / BigInt(purchases24h.length)
            ).toString()
          : "0";
      const holdings = Object.values(credits.credits);

      return {
        success: true,
        data: {
          totalVolume24h: volume(purchases24h),
          totalVolume7d: volume(purchases7d),
          totalTransactions24h: purchases24h.length,
          totalTransactions7d: purchases7d.length,
          activeListings: activeListings.length,
          totalCreditsListed: activeListings.reduce(
            (sum, listing) => sum + listing.remainingAmount,
            0,
          ),
          floorPrice,
          avgPrice24h,
          totalCreditsMinted: holdings.reduce(
            (sum, credit) => sum + (credit.initialCreditsIssued ?? 0),
            0,
          ),
          totalCreditsRetired: holdings.reduce(
            (sum, credit) => sum + (credit.retiredAmount ?? 0),
            0,
          ),
          totalCreditsTraded: market.purchases.reduce(
            (sum, purchase) => sum + purchase.amount,
            0,
          ),
          denomination: "AETH_WEI",
          usdConversion: null,
        },
      };
    },
  );

  fastify.get(
    "/purchases",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Get confirmed on-chain purchase history",
        querystring: {
          type: "object",
          properties: {
            tokenId: { type: "string", pattern: "^\\d+$" },
            buyerWallet: { type: "string" },
            sellerWallet: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (request) => {
      const query = request.query as {
        tokenId?: string;
        buyerWallet?: string;
        sellerWallet?: string;
        limit?: number;
        offset?: number;
      };
      const state = await readState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
      );
      let purchases = [...state.purchases];
      if (query.tokenId) {
        const tokenId = query.tokenId;
        purchases = purchases.filter(
          (purchase) => BigInt(purchase.tokenId) === BigInt(tokenId),
        );
      }
      if (query.buyerWallet) {
        const buyerWallet = query.buyerWallet.toLowerCase();
        purchases = purchases.filter(
          (purchase) => purchase.buyerWallet.toLowerCase() === buyerWallet,
        );
      }
      if (query.sellerWallet) {
        const sellerWallet = query.sellerWallet.toLowerCase();
        purchases = purchases.filter(
          (purchase) => purchase.sellerWallet.toLowerCase() === sellerWallet,
        );
      }
      purchases.sort(
        (left, right) =>
          new Date(right.purchasedAt).getTime() -
          new Date(left.purchasedAt).getTime(),
      );

      const total = purchases.length;
      const limit = Math.min(query.limit || 50, 100);
      const offset = Math.max(query.offset || 0, 0);
      return {
        success: true,
        data: purchases.slice(offset, offset + limit).map((purchase) => ({
          ...purchase,
          explorerUrl: getExplorerTxLink(purchase.txHash),
        })),
        pagination: { total, limit, offset },
      };
    },
  );
}
