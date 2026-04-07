import { randomBytes } from "crypto";

import {
  ListingStatus,
  OfferStatus,
  MarketStats,
} from "@terraqura/types";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import { bearerAuthRateLimit, verifyBearerAuth } from "../../lib/bearer-auth.js";
import { mutateState, readState } from "../../lib/state-store.js";

const CreateListingSchema = z.object({
  tokenId: z.string().min(1),
  amount: z.number().int().positive(),
  pricePerUnit: z.string().regex(/^\d+$/),
  minPurchaseAmount: z.number().int().positive().optional(),
  durationDays: z.number().int().min(0).max(365).optional(),
});

const CreateOfferSchema = z.object({
  tokenId: z.string().min(1),
  amount: z.number().int().positive(),
  pricePerUnit: z.string().regex(/^\d+$/),
  durationDays: z.number().int().min(1).max(30),
});

const PurchaseSchema = z.object({
  amount: z.number().int().positive(),
});

interface StoredListing {
  id: string;
  listingId: string;
  sellerId: string;
  sellerWallet: string;
  tokenId: string;
  creditId: string;
  dacUnitName: string;
  amount: number;
  remainingAmount: number;
  pricePerUnit: string;
  pricePerUnitUsd: number;
  minPurchaseAmount: number;
  status: ListingStatus;
  createdAt: string;
  expiresAt: string | null;
  soldAt: string | null;
  cancelledAt: string | null;
  txHash: string | null;
}

interface StoredOffer {
  id: string;
  offerId: string;
  buyerId: string;
  buyerWallet: string;
  tokenId: string;
  creditId: string | null;
  amount: number;
  pricePerUnit: string;
  pricePerUnitUsd: number;
  depositAmount: string;
  status: OfferStatus;
  acceptedBy: string | null;
  acceptedByWallet: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  txHash: string | null;
  acceptTxHash: string | null;
}

interface StoredPurchase {
  id: string;
  listingId: string | null;
  offerId: string | null;
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
  offers: Record<string, StoredOffer>;
  purchases: StoredPurchase[];
  nextListingId: number;
  nextOfferId: number;
}

interface CreditsState {
  credits: Record<
    string,
    {
      initialCreditsIssued?: number;
      retiredAmount?: number;
      creditsIssued: number;
      isRetired: boolean;
    }
  >;
}

const MARKETPLACE_STORE_KEY = "marketplace:v1";
const DEFAULT_MARKETPLACE_STATE: MarketplaceState = {
  listings: {},
  offers: {},
  purchases: [],
  nextListingId: 1,
  nextOfferId: 1,
};
const CREDITS_STORE_KEY = "credits:v1";
const DEFAULT_CREDITS_STATE: CreditsState = {
  credits: {},
};

function getAuthenticatedAddress(request: { user?: unknown }): string | null {
  const user = request.user as { address?: string } | undefined;
  return typeof user?.address === "string" ? user.address.toLowerCase() : null;
}

function isAdmin(request: { user?: unknown }): boolean {
  const user = request.user as { userType?: string } | undefined;
  return user?.userType === "admin";
}

function weiToUsd(wei: string): number {
  const maticUsd = Number.parseFloat(process.env.MATIC_USD_PRICE || "0.5");
  const matic = Number(wei) / 1e18;
  return Number.isFinite(matic) ? matic * maticUsd : 0;
}

function generateTxHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

function isExpired(dateIso: string | null): boolean {
  if (!dateIso) {
    return false;
  }
  return Date.now() > new Date(dateIso).getTime();
}

function getActiveListingStatus(listing: StoredListing): ListingStatus {
  if (listing.status !== ListingStatus.ACTIVE) {
    return listing.status;
  }
  if (isExpired(listing.expiresAt)) {
    return ListingStatus.EXPIRED;
  }
  return listing.status;
}

function getActiveOfferStatus(offer: StoredOffer): OfferStatus {
  if (offer.status !== OfferStatus.ACTIVE) {
    return offer.status;
  }
  if (isExpired(offer.expiresAt)) {
    return OfferStatus.EXPIRED;
  }
  return offer.status;
}

function computePlatformFee(totalPriceWei: string): string {
  return ((BigInt(totalPriceWei) * BigInt(250)) / BigInt(10000)).toString();
}

function listingResponse(listing: StoredListing) {
  return {
    ...listing,
    status: getActiveListingStatus(listing),
    createdAt: listing.createdAt,
    expiresAt: listing.expiresAt,
  };
}

function offerResponse(offer: StoredOffer) {
  return {
    ...offer,
    status: getActiveOfferStatus(offer),
    createdAt: offer.createdAt,
    expiresAt: offer.expiresAt,
  };
}

export async function marketplaceRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.get(
    "/listings",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Get marketplace listings",
        description: "Returns carbon credit listings with optional filters",
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["active", "sold", "cancelled", "expired"] },
            tokenId: { type: "string" },
            sellerId: { type: "string" },
            minPrice: { type: "string" },
            maxPrice: { type: "string" },
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
    async (request, _reply) => {
      const query = request.query as {
        status?: string;
        tokenId?: string;
        sellerId?: string;
        minPrice?: string;
        maxPrice?: string;
        sortBy?: string;
        limit?: number;
        offset?: number;
      };

      const state = await readState(MARKETPLACE_STORE_KEY, DEFAULT_MARKETPLACE_STATE);
      let listings = Object.values(state.listings).map((listing) => ({
        ...listing,
        status: getActiveListingStatus(listing),
      }));

      if (query.status) {
        listings = listings.filter((listing) => listing.status === query.status);
      } else {
        listings = listings.filter((listing) => listing.status === ListingStatus.ACTIVE);
      }

      if (query.tokenId) {
        listings = listings.filter((listing) => listing.tokenId === query.tokenId);
      }

      if (query.sellerId) {
        listings = listings.filter((listing) => listing.sellerId === query.sellerId);
      }

      if (typeof query.minPrice === "string") {
        listings = listings.filter(
          (listing) => BigInt(listing.pricePerUnit) >= BigInt(query.minPrice as string)
        );
      }

      if (typeof query.maxPrice === "string") {
        listings = listings.filter(
          (listing) => BigInt(listing.pricePerUnit) <= BigInt(query.maxPrice as string)
        );
      }

      switch (query.sortBy) {
        case "price_asc":
          listings.sort((a, b) => (BigInt(a.pricePerUnit) > BigInt(b.pricePerUnit) ? 1 : -1));
          break;
        case "price_desc":
          listings.sort((a, b) => (BigInt(a.pricePerUnit) < BigInt(b.pricePerUnit) ? 1 : -1));
          break;
        case "oldest":
          listings.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          break;
        case "amount":
          listings.sort((a, b) => b.remainingAmount - a.remainingAmount);
          break;
        case "newest":
        default:
          listings.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }

      const total = listings.length;
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      listings = listings.slice(offset, offset + limit);

      return {
        success: true,
        data: listings.map((listing) => listingResponse(listing)),
        pagination: { total, limit, offset },
      };
    }
  );

  fastify.post(
    "/listings",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Create a listing",
        description: "List carbon credits for sale on the marketplace",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["tokenId", "amount", "pricePerUnit"],
          properties: {
            tokenId: { type: "string" },
            amount: { type: "number" },
            pricePerUnit: { type: "string" },
            minPurchaseAmount: { type: "number" },
            durationDays: { type: "number" },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const body = CreateListingSchema.parse(request.body);
      const sellerWallet = getAuthenticatedAddress(request);
      if (!sellerWallet) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const listing = await mutateState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
        async (state) => {
          const id = `listing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const listingId = String(state.nextListingId++);
          const txHash = generateTxHash();
          const nowIso = new Date().toISOString();

          const created: StoredListing = {
            id,
            listingId,
            sellerId: `user_${sellerWallet.slice(2, 10)}`,
            sellerWallet,
            tokenId: body.tokenId,
            creditId: `credit_${body.tokenId}`,
            dacUnitName: "TerraQura DAC Facility",
            amount: body.amount,
            remainingAmount: body.amount,
            pricePerUnit: body.pricePerUnit,
            pricePerUnitUsd: weiToUsd(body.pricePerUnit),
            minPurchaseAmount: body.minPurchaseAmount || 1,
            status: ListingStatus.ACTIVE,
            createdAt: nowIso,
            expiresAt: body.durationDays
              ? new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000).toISOString()
              : null,
            soldAt: null,
            cancelledAt: null,
            txHash,
          };

          state.listings[id] = created;
          return created;
        }
      );

      return reply.status(201).send({
        success: true,
        data: {
          listingId: listing.id,
          status: listing.status,
          txHash: listing.txHash,
        },
      });
    }
  );

  fastify.get(
    "/listings/:id",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Get listing details",
        params: { type: "object", properties: { id: { type: "string" } } },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const state = await readState(MARKETPLACE_STORE_KEY, DEFAULT_MARKETPLACE_STATE);
      const listings = new Map(Object.entries(state.listings));
      const listing = listings.get(params.id);

      if (!listing) {
        return reply.status(404).send({ success: false, error: "Listing not found" });
      }

      return {
        success: true,
        data: listingResponse(listing),
      };
    }
  );

  fastify.delete(
    "/listings/:id",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Cancel a listing",
        security: [{ bearerAuth: [] }],
        params: { type: "object", properties: { id: { type: "string" } } },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const callerWallet = getAuthenticatedAddress(request);
      if (!callerWallet) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const result = await mutateState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
        async (state) => {
          const listings = new Map(Object.entries(state.listings));
          const listing = listings.get(params.id);
          if (!listing) {
            return { kind: "not_found" as const };
          }

          const effectiveStatus = getActiveListingStatus(listing);
          if (effectiveStatus === ListingStatus.EXPIRED) {
            listing.status = ListingStatus.EXPIRED;
            listings.set(params.id, listing);
            state.listings = Object.fromEntries(listings);
            return { kind: "expired" as const };
          }

          const isOwner = listing.sellerWallet.toLowerCase() === callerWallet;
          if (!isOwner && !isAdmin(request)) {
            return { kind: "forbidden" as const };
          }

          if (listing.status !== ListingStatus.ACTIVE) {
            return { kind: "not_active" as const };
          }

          listing.status = ListingStatus.CANCELLED;
          listing.cancelledAt = new Date().toISOString();
          listings.set(params.id, listing);
          state.listings = Object.fromEntries(listings);
          return { kind: "success" as const, listing };
        }
      );

      if (result.kind === "not_found") {
        return reply.status(404).send({ success: false, error: "Listing not found" });
      }

      if (result.kind === "expired") {
        return reply.status(400).send({ success: false, error: "Listing expired" });
      }

      if (result.kind === "forbidden") {
        return reply.status(403).send({
          success: false,
          error: "Only the seller or an admin can cancel this listing",
        });
      }

      if (result.kind === "not_active") {
        return reply.status(400).send({ success: false, error: "Listing not active" });
      }

      return {
        success: true,
        data: {
          listingId: params.id,
          status: result.listing.status,
          txHash: generateTxHash(),
        },
      };
    }
  );

  fastify.post(
    "/listings/:id/purchase",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Purchase credits from listing",
        security: [{ bearerAuth: [] }],
        params: { type: "object", properties: { id: { type: "string" } } },
        body: {
          type: "object",
          required: ["amount"],
          properties: { amount: { type: "number" } },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = PurchaseSchema.parse(request.body);
      const buyerWallet = getAuthenticatedAddress(request);
      if (!buyerWallet) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const result = await mutateState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
        async (state) => {
          const listings = new Map(Object.entries(state.listings));
          const listing = listings.get(params.id);
          if (!listing) {
            return { kind: "not_found" as const };
          }

          const effectiveStatus = getActiveListingStatus(listing);
          if (effectiveStatus === ListingStatus.EXPIRED) {
            listing.status = ListingStatus.EXPIRED;
            listings.set(params.id, listing);
            state.listings = Object.fromEntries(listings);
            return { kind: "expired" as const };
          }

          if (listing.status !== ListingStatus.ACTIVE) {
            return { kind: "not_active" as const };
          }

          if (listing.sellerWallet.toLowerCase() === buyerWallet) {
            return { kind: "self_purchase" as const };
          }

          if (body.amount > listing.remainingAmount) {
            return { kind: "insufficient" as const };
          }

          if (body.amount < listing.minPurchaseAmount) {
            return { kind: "below_minimum" as const };
          }

          const totalPrice = (BigInt(listing.pricePerUnit) * BigInt(body.amount)).toString();
          const platformFee = computePlatformFee(totalPrice);
          const sellerProceeds = (BigInt(totalPrice) - BigInt(platformFee)).toString();
          const txHash = generateTxHash();

          listing.remainingAmount -= body.amount;
          if (listing.remainingAmount === 0) {
            listing.status = ListingStatus.SOLD;
            listing.soldAt = new Date().toISOString();
          }
          listings.set(params.id, listing);
          state.listings = Object.fromEntries(listings);

          const purchase: StoredPurchase = {
            id: `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            listingId: params.id,
            offerId: null,
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
            sellerProceeds,
            txHash,
            blockNumber: Math.floor(Math.random() * 1000000) + 50000000,
            purchasedAt: new Date().toISOString(),
          };
          state.purchases.push(purchase);

          return { kind: "success" as const, purchase, listing };
        }
      );

      if (result.kind === "not_found") {
        return reply.status(404).send({ success: false, error: "Listing not found" });
      }
      if (result.kind === "expired") {
        return reply.status(400).send({ success: false, error: "Listing expired" });
      }
      if (result.kind === "not_active") {
        return reply.status(400).send({ success: false, error: "Listing not active" });
      }
      if (result.kind === "self_purchase") {
        return reply.status(400).send({
          success: false,
          error: "Seller cannot purchase their own listing",
        });
      }
      if (result.kind === "insufficient") {
        return reply.status(400).send({ success: false, error: "Insufficient credits available" });
      }
      if (result.kind === "below_minimum") {
        return reply.status(400).send({ success: false, error: "Below minimum purchase amount" });
      }

      return reply.status(201).send({
        success: true,
        data: {
          purchaseId: result.purchase.id,
          amount: result.purchase.amount,
          totalPrice: result.purchase.totalPrice,
          platformFee: result.purchase.platformFee,
          txHash: result.purchase.txHash,
          explorerUrl: `https://explorer.aethelred.network/tx/${result.purchase.txHash}`,
        },
      });
    }
  );

  fastify.get(
    "/offers",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Get offers",
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            tokenId: { type: "string" },
            buyerId: { type: "string" },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
    },
    async (request, _reply) => {
      const query = request.query as {
        status?: string;
        tokenId?: string;
        buyerId?: string;
        limit?: number;
        offset?: number;
      };

      const state = await readState(MARKETPLACE_STORE_KEY, DEFAULT_MARKETPLACE_STATE);
      let offers = Object.values(state.offers).map((offer) => ({
        ...offer,
        status: getActiveOfferStatus(offer),
      }));

      if (query.status) {
        offers = offers.filter((offer) => offer.status === query.status);
      } else {
        offers = offers.filter((offer) => offer.status === OfferStatus.ACTIVE);
      }

      if (query.tokenId) {
        offers = offers.filter((offer) => offer.tokenId === query.tokenId);
      }

      if (query.buyerId) {
        offers = offers.filter((offer) => offer.buyerId === query.buyerId);
      }

      offers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total = offers.length;
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      offers = offers.slice(offset, offset + limit);

      return {
        success: true,
        data: offers.map((offer) => offerResponse(offer)),
        pagination: { total, limit, offset },
      };
    }
  );

  fastify.post(
    "/offers",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Create an offer",
        description: "Make an offer to buy credits from any holder",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["tokenId", "amount", "pricePerUnit", "durationDays"],
          properties: {
            tokenId: { type: "string" },
            amount: { type: "number" },
            pricePerUnit: { type: "string" },
            durationDays: { type: "number" },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const body = CreateOfferSchema.parse(request.body);
      const buyerWallet = getAuthenticatedAddress(request);
      if (!buyerWallet) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const offer = await mutateState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
        async (state) => {
          const id = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const offerId = String(state.nextOfferId++);
          const depositAmount = (BigInt(body.pricePerUnit) * BigInt(body.amount)).toString();
          const txHash = generateTxHash();
          const createdAt = new Date().toISOString();
          const expiresAt = new Date(
            Date.now() + body.durationDays * 24 * 60 * 60 * 1000
          ).toISOString();

          const created: StoredOffer = {
            id,
            offerId,
            buyerId: `user_${buyerWallet.slice(2, 10)}`,
            buyerWallet,
            tokenId: body.tokenId,
            creditId: null,
            amount: body.amount,
            pricePerUnit: body.pricePerUnit,
            pricePerUnitUsd: weiToUsd(body.pricePerUnit),
            depositAmount,
            status: OfferStatus.ACTIVE,
            acceptedBy: null,
            acceptedByWallet: null,
            createdAt,
            expiresAt,
            acceptedAt: null,
            cancelledAt: null,
            txHash,
            acceptTxHash: null,
          };

          state.offers[id] = created;
          return created;
        }
      );

      return reply.status(201).send({
        success: true,
        data: {
          offerId: offer.id,
          depositAmount: offer.depositAmount,
          status: offer.status,
          expiresAt: offer.expiresAt,
          txHash: offer.txHash,
        },
      });
    }
  );

  fastify.post(
    "/offers/:id/accept",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Accept an offer",
        description: "Accept an offer as a credit holder",
        security: [{ bearerAuth: [] }],
        params: { type: "object", properties: { id: { type: "string" } } },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const sellerWallet = getAuthenticatedAddress(request);
      if (!sellerWallet) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const result = await mutateState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
        async (state) => {
          const offers = new Map(Object.entries(state.offers));
          const offer = offers.get(params.id);
          if (!offer) {
            return { kind: "not_found" as const };
          }

          const effectiveStatus = getActiveOfferStatus(offer);
          if (effectiveStatus === OfferStatus.EXPIRED) {
            offer.status = OfferStatus.EXPIRED;
            offers.set(params.id, offer);
            state.offers = Object.fromEntries(offers);
            return { kind: "expired" as const };
          }

          if (offer.status !== OfferStatus.ACTIVE) {
            return { kind: "not_active" as const };
          }

          if (offer.buyerWallet.toLowerCase() === sellerWallet) {
            return { kind: "self_accept" as const };
          }

          const acceptTxHash = generateTxHash();
          const platformFee = computePlatformFee(offer.depositAmount);
          const sellerProceeds = (BigInt(offer.depositAmount) - BigInt(platformFee)).toString();
          const acceptedAt = new Date().toISOString();

          offer.status = OfferStatus.ACCEPTED;
          offer.acceptedBy = `user_${sellerWallet.slice(2, 10)}`;
          offer.acceptedByWallet = sellerWallet;
          offer.acceptedAt = acceptedAt;
          offer.acceptTxHash = acceptTxHash;
          offers.set(params.id, offer);
          state.offers = Object.fromEntries(offers);

          const purchase: StoredPurchase = {
            id: `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            listingId: null,
            offerId: params.id,
            buyerId: offer.buyerId,
            buyerWallet: offer.buyerWallet,
            sellerId: offer.acceptedBy,
            sellerWallet: offer.acceptedByWallet,
            tokenId: offer.tokenId,
            creditId: `credit_${offer.tokenId}`,
            amount: offer.amount,
            pricePerUnit: offer.pricePerUnit,
            totalPrice: offer.depositAmount,
            platformFee,
            sellerProceeds,
            txHash: acceptTxHash,
            blockNumber: Math.floor(Math.random() * 1000000) + 50000000,
            purchasedAt: acceptedAt,
          };
          state.purchases.push(purchase);

          return { kind: "success" as const, offer, purchase };
        }
      );

      if (result.kind === "not_found") {
        return reply.status(404).send({ success: false, error: "Offer not found" });
      }
      if (result.kind === "expired") {
        return reply.status(400).send({ success: false, error: "Offer expired" });
      }
      if (result.kind === "not_active") {
        return reply.status(400).send({ success: false, error: "Offer not active" });
      }
      if (result.kind === "self_accept") {
        return reply.status(400).send({
          success: false,
          error: "Buyer cannot accept their own offer",
        });
      }

      return {
        success: true,
        data: {
          offerId: params.id,
          status: result.offer.status,
          amount: result.offer.amount,
          totalPrice: result.offer.depositAmount,
          sellerProceeds: result.purchase.sellerProceeds,
          txHash: result.offer.acceptTxHash,
          explorerUrl: `https://explorer.aethelred.network/tx/${result.offer.acceptTxHash}`,
        },
      };
    }
  );

  fastify.delete(
    "/offers/:id",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Cancel an offer",
        security: [{ bearerAuth: [] }],
        params: { type: "object", properties: { id: { type: "string" } } },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const callerWallet = getAuthenticatedAddress(request);
      if (!callerWallet) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const result = await mutateState(
        MARKETPLACE_STORE_KEY,
        DEFAULT_MARKETPLACE_STATE,
        async (state) => {
          const offers = new Map(Object.entries(state.offers));
          const offer = offers.get(params.id);
          if (!offer) {
            return { kind: "not_found" as const };
          }

          const effectiveStatus = getActiveOfferStatus(offer);
          if (effectiveStatus === OfferStatus.EXPIRED) {
            offer.status = OfferStatus.EXPIRED;
            offers.set(params.id, offer);
            state.offers = Object.fromEntries(offers);
            return { kind: "expired" as const };
          }

          if (offer.status !== OfferStatus.ACTIVE) {
            return { kind: "not_active" as const };
          }

          const isOwner = offer.buyerWallet.toLowerCase() === callerWallet;
          if (!isOwner && !isAdmin(request)) {
            return { kind: "forbidden" as const };
          }

          offer.status = OfferStatus.CANCELLED;
          offer.cancelledAt = new Date().toISOString();
          offers.set(params.id, offer);
          state.offers = Object.fromEntries(offers);
          return { kind: "success" as const, offer };
        }
      );

      if (result.kind === "not_found") {
        return reply.status(404).send({ success: false, error: "Offer not found" });
      }
      if (result.kind === "expired") {
        return reply.status(400).send({ success: false, error: "Offer expired" });
      }
      if (result.kind === "not_active") {
        return reply.status(400).send({ success: false, error: "Offer not active" });
      }
      if (result.kind === "forbidden") {
        return reply.status(403).send({
          success: false,
          error: "Only the buyer or an admin can cancel this offer",
        });
      }

      return {
        success: true,
        data: {
          offerId: params.id,
          status: result.offer.status,
          refundAmount: result.offer.depositAmount,
          txHash: generateTxHash(),
        },
      };
    }
  );

  fastify.get(
    "/stats",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Get market statistics",
        description: "Returns marketplace volume, pricing, and activity stats",
      },
    },
    async (_request, _reply) => {
      const state = await readState(MARKETPLACE_STORE_KEY, DEFAULT_MARKETPLACE_STATE);
      const creditsState = await readState(CREDITS_STORE_KEY, DEFAULT_CREDITS_STATE);

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      const purchases24h = state.purchases.filter(
        (purchase) => new Date(purchase.purchasedAt).getTime() > oneDayAgo
      );
      const purchases7d = state.purchases.filter(
        (purchase) => new Date(purchase.purchasedAt).getTime() > sevenDaysAgo
      );

      const totalVolume24h = purchases24h
        .reduce((sum, purchase) => sum + BigInt(purchase.totalPrice), BigInt(0))
        .toString();
      const totalVolume7d = purchases7d
        .reduce((sum, purchase) => sum + BigInt(purchase.totalPrice), BigInt(0))
        .toString();

      const activeListings = Object.values(state.listings).filter(
        (listing) => getActiveListingStatus(listing) === ListingStatus.ACTIVE
      );
      const totalCreditsListed = activeListings.reduce(
        (sum, listing) => sum + listing.remainingAmount,
        0
      );
      const firstActiveListing = activeListings[0];

      const floorPrice =
        firstActiveListing
          ? activeListings.reduce(
              (min, listing) =>
                BigInt(listing.pricePerUnit) < BigInt(min) ? listing.pricePerUnit : min,
              firstActiveListing.pricePerUnit
            )
          : "0";

      const avgPrice24h =
        purchases24h.length > 0
          ? (
              purchases24h.reduce(
                (sum, purchase) => sum + BigInt(purchase.pricePerUnit),
                BigInt(0)
              ) / BigInt(purchases24h.length)
            ).toString()
          : "0";

      const creditValues = Object.values(creditsState.credits);
      const totalCreditsMinted = creditValues.reduce(
        (sum, credit) => sum + (credit.initialCreditsIssued ?? credit.creditsIssued),
        0
      );
      const totalCreditsRetired = creditValues.reduce(
        (sum, credit) => sum + (credit.retiredAmount ?? 0),
        0
      );

      const stats: MarketStats = {
        totalVolume24h,
        totalVolumeUsd24h: weiToUsd(totalVolume24h),
        totalVolume7d,
        totalVolumeUsd7d: weiToUsd(totalVolume7d),
        totalTransactions24h: purchases24h.length,
        totalTransactions7d: purchases7d.length,
        activeListings: activeListings.length,
        totalCreditsListed,
        floorPrice,
        floorPriceUsd: weiToUsd(floorPrice),
        avgPrice24h,
        avgPriceUsd24h: weiToUsd(avgPrice24h),
        totalCreditsMinted,
        totalCreditsRetired,
        totalCreditsTraded: state.purchases.reduce((sum, purchase) => sum + purchase.amount, 0),
      };

      return { success: true, data: stats };
    }
  );

  fastify.get(
    "/purchases",
    {
      schema: {
        tags: ["Marketplace"],
        summary: "Get purchase history",
        querystring: {
          type: "object",
          properties: {
            tokenId: { type: "string" },
            buyerId: { type: "string" },
            sellerId: { type: "string" },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer", default: 0 },
          },
        },
      },
    },
    async (request, _reply) => {
      const query = request.query as {
        tokenId?: string;
        buyerId?: string;
        sellerId?: string;
        limit?: number;
        offset?: number;
      };

      const state = await readState(MARKETPLACE_STORE_KEY, DEFAULT_MARKETPLACE_STATE);
      let purchases = [...state.purchases];

      if (query.tokenId) {
        purchases = purchases.filter((purchase) => purchase.tokenId === query.tokenId);
      }
      if (query.buyerId) {
        purchases = purchases.filter((purchase) => purchase.buyerId === query.buyerId);
      }
      if (query.sellerId) {
        purchases = purchases.filter((purchase) => purchase.sellerId === query.sellerId);
      }

      purchases.sort(
        (a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
      );

      const total = purchases.length;
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      purchases = purchases.slice(offset, offset + limit);

      return {
        success: true,
        data: purchases,
        pagination: { total, limit, offset },
      };
    }
  );
}
