/**
 * Marketplace types for TerraQura P2P trading
 */

export enum ListingStatus {
  ACTIVE = "active",
  SOLD = "sold",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

export enum OfferStatus {
  ACTIVE = "active",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/**
 * Marketplace listing for selling credits
 */
export interface Listing {
  id: string;
  listingId: string; // On-chain ID

  // Seller info
  sellerId: string;
  sellerWallet: string;

  // Credit details
  tokenId: string;
  creditId: string;
  dacUnitName: string;

  // Listing details
  amount: number;
  remainingAmount: number;
  pricePerUnit: string; // In wei
  pricePerUnitUsd: number;
  minPurchaseAmount: number;

  // Status
  status: ListingStatus;

  // Timestamps
  createdAt: Date;
  expiresAt: Date | null;
  soldAt: Date | null;
  cancelledAt: Date | null;

  // Blockchain
  txHash: string | null;
}

export interface CreateListingInput {
  tokenId: string;
  amount: number;
  pricePerUnit: string; // In wei
  minPurchaseAmount?: number;
  durationDays?: number; // 0 = no expiry
}

/**
 * Offer to buy credits
 */
export interface Offer {
  id: string;
  offerId: string; // On-chain ID

  // Buyer info
  buyerId: string;
  buyerWallet: string;

  // Credit details
  tokenId: string;
  creditId: string | null; // Null if offer is for any holder

  // Offer details
  amount: number;
  pricePerUnit: string; // In wei
  pricePerUnitUsd: number;
  depositAmount: string; // Total deposited in wei

  // Status
  status: OfferStatus;

  // Acceptance info (if accepted)
  acceptedBy: string | null;
  acceptedByWallet: string | null;

  // Timestamps
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  cancelledAt: Date | null;

  // Blockchain
  txHash: string | null;
  acceptTxHash: string | null;
}

export interface CreateOfferInput {
  tokenId: string;
  amount: number;
  pricePerUnit: string; // In wei
  durationDays: number;
}

/**
 * Purchase record
 */
export interface Purchase {
  id: string;

  // Transaction details
  listingId: string | null;
  offerId: string | null;

  // Parties
  buyerId: string;
  buyerWallet: string;
  sellerId: string;
  sellerWallet: string;

  // Credit details
  tokenId: string;
  creditId: string;
  amount: number;

  // Pricing
  pricePerUnit: string;
  totalPrice: string;
  platformFee: string;
  sellerProceeds: string;

  // Blockchain
  txHash: string;
  blockNumber: number;

  // Timestamp
  purchasedAt: Date;
}

/**
 * Market statistics
 */
export interface MarketStats {
  // Volume
  totalVolume24h: string; // In wei
  totalVolumeUsd24h: number;
  totalVolume7d: string;
  totalVolumeUsd7d: number;

  // Transactions
  totalTransactions24h: number;
  totalTransactions7d: number;

  // Listings
  activeListings: number;
  totalCreditsListed: number;

  // Pricing
  floorPrice: string; // Lowest listing price
  floorPriceUsd: number;
  avgPrice24h: string;
  avgPriceUsd24h: number;

  // Credits
  totalCreditsMinted: number;
  totalCreditsRetired: number;
  totalCreditsTraded: number;
}

/**
 * Price history point
 */
export interface PricePoint {
  timestamp: Date;
  price: string; // Average price in wei
  priceUsd: number;
  volume: string;
  volumeUsd: number;
  transactions: number;
}

/**
 * Marketplace configuration
 */
export interface MarketplaceConfig {
  platformFeeBps: number; // Basis points (100 = 1%)
  maxFeeBps: number;
  feeRecipient: string;
  kycRequired: boolean;
  minListingDuration: number; // In seconds
  maxListingDuration: number;
  minOfferDuration: number;
  maxOfferDuration: number;
}

/**
 * User marketplace activity
 */
export interface UserMarketActivity {
  userId: string;
  walletAddress: string;

  // As seller
  totalListings: number;
  activeListings: number;
  totalSold: number;
  totalSalesVolume: string;

  // As buyer
  totalOffers: number;
  activeOffers: number;
  totalPurchased: number;
  totalPurchaseVolume: string;

  // Reputation (optional for future)
  successfulTransactions: number;
  cancelledTransactions: number;
}

/**
 * Listing filter options
 */
export interface ListingFilters {
  status?: ListingStatus;
  tokenId?: string;
  sellerId?: string;
  minPrice?: string;
  maxPrice?: string;
  minAmount?: number;
  sortBy?: "price_asc" | "price_desc" | "newest" | "oldest" | "amount";
  limit?: number;
  offset?: number;
}

/**
 * Offer filter options
 */
export interface OfferFilters {
  status?: OfferStatus;
  tokenId?: string;
  buyerId?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: "price_asc" | "price_desc" | "newest" | "oldest";
  limit?: number;
  offset?: number;
}
