// TerraQura Marketplace Subgraph Mappings

import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  ListingCreated,
  ListingCancelled,
  Purchase as PurchaseEvent,
  OfferCreated,
  OfferAccepted,
  OfferCancelled,
  PlatformFeeUpdated,
} from "../generated/CarbonMarketplace/CarbonMarketplace";
import {
  Listing,
  Offer,
  Purchase,
  User,
  CarbonCredit,
  DailyStats,
  MarketStats,
} from "../generated/schema";

// Helper: Get or create User entity
function getOrCreateUser(address: Address): User {
  let id = address.toHexString();
  let user = User.load(id);

  if (user == null) {
    user = new User(id);
    user.totalCreditsOwned = BigInt.fromI32(0);
    user.totalCreditsRetired = BigInt.fromI32(0);
    user.totalCreditsMinted = BigInt.fromI32(0);
    user.totalVolumeBought = BigInt.fromI32(0);
    user.totalVolumeSold = BigInt.fromI32(0);
    user.totalCO2Captured = BigInt.fromI32(0);
    user.isKycVerified = false;
    user.firstSeen = BigInt.fromI32(0);
    user.lastActive = BigInt.fromI32(0);
    user.save();

    // Update global stats
    let stats = getOrCreateMarketStats();
    stats.totalUsers = stats.totalUsers + 1;
    stats.save();
  }

  return user;
}

// Helper: Get or create daily stats
function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let dayTimestamp = timestamp.div(BigInt.fromI32(86400)).times(BigInt.fromI32(86400));
  let id = dayTimestamp.toString();
  let stats = DailyStats.load(id);

  if (stats == null) {
    stats = new DailyStats(id);
    stats.date = dayTimestamp.toI32();
    stats.creditsMinted = BigInt.fromI32(0);
    stats.mintTransactions = 0;
    stats.creditsRetired = BigInt.fromI32(0);
    stats.retirementTransactions = 0;
    stats.volumeTraded = BigInt.fromI32(0);
    stats.tradeTransactions = 0;
    stats.uniqueBuyers = 0;
    stats.uniqueSellers = 0;
    stats.newListings = 0;
    stats.cancelledListings = 0;
    stats.verificationsSubmitted = 0;
    stats.verificationsCompleted = 0;
    stats.verificationsPassed = 0;
    stats.save();
  }

  return stats;
}

// Helper: Get or create market stats
function getOrCreateMarketStats(): MarketStats {
  let stats = MarketStats.load("global");

  if (stats == null) {
    stats = new MarketStats("global");
    stats.totalCreditsMinted = BigInt.fromI32(0);
    stats.totalCreditsRetired = BigInt.fromI32(0);
    stats.totalCreditsActive = BigInt.fromI32(0);
    stats.totalVolumeTraded = BigInt.fromI32(0);
    stats.totalTransactions = 0;
    stats.totalPlatformFeesCollected = BigInt.fromI32(0);
    stats.currentFeeBps = BigInt.fromI32(250); // Default 2.5%, dynamically updated by PlatformFeeUpdated
    stats.totalUsers = 0;
    stats.totalOperators = 0;
    stats.totalBuyers = 0;
    stats.activeListings = 0;
    stats.totalListings = 0;
    stats.activeOffers = 0;
    stats.totalOffers = 0;
    stats.totalCO2Captured = BigInt.fromI32(0);
    stats.totalCO2Retired = BigInt.fromI32(0);
    stats.totalBufferPoolCredits = BigInt.fromI32(0);
    stats.totalReversalsBurned = BigInt.fromI32(0);
    stats.lastUpdated = BigInt.fromI32(0);
    stats.save();
  }

  return stats;
}

// Handle ListingCreated event
export function handleListingCreated(event: ListingCreated): void {
  let listingId = event.params.listingId.toString();

  let listing = new Listing(listingId);
  listing.listingId = event.params.listingId;
  listing.seller = event.params.seller.toHexString();
  listing.tokenId = event.params.tokenId;
  listing.amount = event.params.amount;
  listing.amountRemaining = event.params.amount;
  listing.pricePerUnit = event.params.pricePerUnit;
  listing.minPurchaseAmount = BigInt.fromI32(0); // Default, update if event includes this
  listing.status = "ACTIVE";
  listing.createdAt = event.block.timestamp;
  listing.txHash = event.transaction.hash;

  // Link to credit
  let creditId = event.params.tokenId.toString();
  let credit = CarbonCredit.load(creditId);
  if (credit != null) {
    listing.credit = creditId;
    credit.status = "LISTED";
    credit.currentListing = listingId;
    credit.lastUpdated = event.block.timestamp;
    credit.save();
  }

  listing.save();

  // Update seller
  let seller = getOrCreateUser(event.params.seller);
  seller.lastActive = event.block.timestamp;
  seller.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.newListings = dailyStats.newListings + 1;
  dailyStats.save();

  // Update global stats
  let marketStats = getOrCreateMarketStats();
  marketStats.activeListings = marketStats.activeListings + 1;
  marketStats.totalListings = marketStats.totalListings + 1;
  marketStats.lastUpdated = event.block.timestamp;
  marketStats.save();
}

// Handle ListingCancelled event
export function handleListingCancelled(event: ListingCancelled): void {
  let listingId = event.params.listingId.toString();
  let listing = Listing.load(listingId);

  if (listing != null) {
    listing.status = "CANCELLED";
    listing.cancelledAt = event.block.timestamp;
    listing.save();

    // Update credit
    let credit = CarbonCredit.load(listing.tokenId.toString());
    if (credit != null) {
      credit.status = "ACTIVE";
      credit.currentListing = null;
      credit.lastUpdated = event.block.timestamp;
      credit.save();
    }

    // Update daily stats
    let dailyStats = getOrCreateDailyStats(event.block.timestamp);
    dailyStats.cancelledListings = dailyStats.cancelledListings + 1;
    dailyStats.save();

    // Update global stats
    let marketStats = getOrCreateMarketStats();
    marketStats.activeListings = marketStats.activeListings - 1;
    marketStats.lastUpdated = event.block.timestamp;
    marketStats.save();
  }
}

// Handle Purchase event
export function handlePurchase(event: PurchaseEvent): void {
  let listingId = event.params.listingId.toString();
  let listing = Listing.load(listingId);

  if (listing != null) {
    // Calculate purchase amount
    let purchaseAmount = event.params.amount;
    let totalPrice = event.params.totalPrice;
    let platformFee = event.params.platformFee;

    // Create purchase record
    let purchaseId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let purchase = new Purchase(purchaseId);
    purchase.buyer = event.params.buyer.toHexString();
    purchase.seller = event.params.seller.toHexString();
    purchase.listing = listingId;
    purchase.tokenId = event.params.tokenId;
    purchase.amount = purchaseAmount;
    purchase.pricePerUnit = listing.pricePerUnit;
    purchase.totalPrice = totalPrice;
    purchase.platformFee = platformFee;
    purchase.timestamp = event.block.timestamp;
    purchase.txHash = event.transaction.hash;
    purchase.blockNumber = event.block.number;
    purchase.save();

    // Update listing
    listing.amountRemaining = listing.amountRemaining.minus(purchaseAmount);
    if (listing.amountRemaining.equals(BigInt.fromI32(0))) {
      listing.status = "SOLD";
      listing.soldOutAt = event.block.timestamp;

      // Update global stats
      let marketStats = getOrCreateMarketStats();
      marketStats.activeListings = marketStats.activeListings - 1;
      marketStats.save();
    }
    listing.save();

    // Update credit
    let credit = CarbonCredit.load(listing.tokenId.toString());
    if (credit != null && listing.status == "SOLD") {
      credit.status = "ACTIVE";
      credit.currentListing = null;
      credit.owner = event.params.buyer.toHexString();
      credit.lastUpdated = event.block.timestamp;
      credit.save();
    }

    // Update buyer
    let buyer = getOrCreateUser(event.params.buyer);
    buyer.totalVolumeBought = buyer.totalVolumeBought.plus(totalPrice);
    buyer.lastActive = event.block.timestamp;
    if (buyer.firstSeen.equals(BigInt.fromI32(0))) {
      buyer.firstSeen = event.block.timestamp;
    }
    buyer.save();

    // Update seller
    let sellerAddress = Address.fromString(listing.seller);
    let seller = getOrCreateUser(sellerAddress);
    seller.totalVolumeSold = seller.totalVolumeSold.plus(totalPrice);
    seller.lastActive = event.block.timestamp;
    seller.save();

    // Update daily stats
    let dailyStats = getOrCreateDailyStats(event.block.timestamp);
    dailyStats.volumeTraded = dailyStats.volumeTraded.plus(totalPrice);
    dailyStats.tradeTransactions = dailyStats.tradeTransactions + 1;
    dailyStats.save();

    // Update global stats
    let marketStats = getOrCreateMarketStats();
    marketStats.totalVolumeTraded = marketStats.totalVolumeTraded.plus(totalPrice);
    marketStats.totalTransactions = marketStats.totalTransactions + 1;
    marketStats.lastUpdated = event.block.timestamp;
    marketStats.save();
  }
}

// Handle OfferCreated event
export function handleOfferCreated(event: OfferCreated): void {
  let offerId = event.params.offerId.toString();

  let offer = new Offer(offerId);
  offer.offerId = event.params.offerId;
  offer.buyer = event.params.buyer.toHexString();
  offer.tokenId = event.params.tokenId;
  offer.amount = event.params.amount;
  offer.pricePerUnit = event.params.pricePerUnit;
  offer.depositAmount = event.params.amount.times(event.params.pricePerUnit); // Full deposit
  offer.status = "ACTIVE";
  offer.createdAt = event.block.timestamp;
  offer.txHash = event.transaction.hash;
  offer.save();

  // Update buyer
  let buyer = getOrCreateUser(event.params.buyer);
  buyer.lastActive = event.block.timestamp;
  buyer.save();

  // Update global stats
  let marketStats = getOrCreateMarketStats();
  marketStats.activeOffers = marketStats.activeOffers + 1;
  marketStats.totalOffers = marketStats.totalOffers + 1;
  marketStats.lastUpdated = event.block.timestamp;
  marketStats.save();
}

// Handle OfferAccepted event
export function handleOfferAccepted(event: OfferAccepted): void {
  let offerId = event.params.offerId.toString();
  let offer = Offer.load(offerId);

  if (offer != null) {
    offer.status = "ACCEPTED";
    offer.acceptedBy = event.params.seller.toHexString();
    offer.acceptedAt = event.block.timestamp;
    offer.save();

    // Calculate values with dynamic fee from MarketStats
    let totalPrice = offer.amount.times(offer.pricePerUnit);
    let dynamicStats = getOrCreateMarketStats();
    let platformFee = totalPrice.times(dynamicStats.currentFeeBps).div(BigInt.fromI32(10000));

    // Create purchase record
    let purchaseId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let purchase = new Purchase(purchaseId);
    purchase.buyer = offer.buyer;
    purchase.seller = event.params.seller.toHexString();
    purchase.tokenId = offer.tokenId;
    purchase.amount = offer.amount;
    purchase.pricePerUnit = offer.pricePerUnit;
    purchase.totalPrice = totalPrice;
    purchase.platformFee = platformFee;
    purchase.timestamp = event.block.timestamp;
    purchase.txHash = event.transaction.hash;
    purchase.blockNumber = event.block.number;
    purchase.save();

    // Update buyer
    let buyerAddress = Address.fromString(offer.buyer);
    let buyer = getOrCreateUser(buyerAddress);
    buyer.totalVolumeBought = buyer.totalVolumeBought.plus(totalPrice);
    buyer.lastActive = event.block.timestamp;
    buyer.save();

    // Update seller
    let seller = getOrCreateUser(event.params.seller);
    seller.totalVolumeSold = seller.totalVolumeSold.plus(totalPrice);
    seller.lastActive = event.block.timestamp;
    seller.save();

    // Update daily stats
    let dailyStats = getOrCreateDailyStats(event.block.timestamp);
    dailyStats.volumeTraded = dailyStats.volumeTraded.plus(totalPrice);
    dailyStats.tradeTransactions = dailyStats.tradeTransactions + 1;
    dailyStats.save();

    // Update global stats
    let marketStats = getOrCreateMarketStats();
    marketStats.activeOffers = marketStats.activeOffers - 1;
    marketStats.totalVolumeTraded = marketStats.totalVolumeTraded.plus(totalPrice);
    marketStats.totalTransactions = marketStats.totalTransactions + 1;
    marketStats.lastUpdated = event.block.timestamp;
    marketStats.save();
  }
}

// Handle OfferCancelled event
export function handleOfferCancelled(event: OfferCancelled): void {
  let offerId = event.params.offerId.toString();
  let offer = Offer.load(offerId);

  if (offer != null) {
    offer.status = "CANCELLED";
    offer.cancelledAt = event.block.timestamp;
    offer.save();

    // Update global stats
    let marketStats = getOrCreateMarketStats();
    marketStats.activeOffers = marketStats.activeOffers - 1;
    marketStats.lastUpdated = event.block.timestamp;
    marketStats.save();
  }
}

// Handle PlatformFeeUpdated event - keeps subgraph fee calculations in sync with contract
export function handlePlatformFeeUpdated(event: PlatformFeeUpdated): void {
  let marketStats = getOrCreateMarketStats();
  marketStats.currentFeeBps = event.params.newFee;
  marketStats.lastUpdated = event.block.timestamp;
  marketStats.save();
}
