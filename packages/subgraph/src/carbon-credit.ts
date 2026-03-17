// TerraQura Carbon Credit Subgraph Mappings

import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  CarbonCredit as CarbonCreditContract,
  CreditMinted,
  CreditRetired,
  TransferSingle,
  TransferBatch,
} from "../generated/CarbonCredit/CarbonCredit";
import {
  CarbonCredit,
  User,
  ProvenanceEvent,
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
    stats.currentFeeBps = BigInt.fromI32(250);
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

// Handle CreditMinted event
export function handleCreditMinted(event: CreditMinted): void {
  let tokenId = event.params.tokenId;
  let creditId = tokenId.toString();
  let recipient = event.params.operator;

  let energyUsed = BigInt.fromI32(0);
  let capturedAmount = event.params.co2AmountKg;
  let efficiencyFactor = BigInt.fromI32(0);
  let mintTimestamp = event.block.timestamp;
  let ipfsCid: string | null = null;

  // Best-effort enrichment from on-chain storage.
  let carbonCreditContract = CarbonCreditContract.bind(event.address);
  let provenanceCall = carbonCreditContract.try_getCreditProvenance(tokenId);
  if (!provenanceCall.reverted) {
    let metadata = provenanceCall.value.value0;
    let verification = provenanceCall.value.value1;
    energyUsed = metadata.energyConsumedKwh;
    capturedAmount = metadata.co2AmountKg;
    efficiencyFactor = verification.efficiencyFactor;
    mintTimestamp = metadata.captureTimestamp;
    ipfsCid = metadata.ipfsMetadataUri;
  }

  // Create credit entity
  let credit = new CarbonCredit(creditId);
  credit.tokenId = tokenId;
  credit.owner = recipient.toHexString();
  credit.amount = event.params.co2AmountKg;
  credit.vintage = mintTimestamp.div(BigInt.fromI32(31536000)).toI32() + 1970; // Approximate year
  credit.dataHash = event.params.sourceDataHash;
  credit.ipfsCid = ipfsCid;
  credit.status = "ACTIVE";
  credit.co2Captured = capturedAmount;
  credit.energyUsed = energyUsed;
  credit.efficiencyFactor = efficiencyFactor;

  credit.mintedAt = mintTimestamp;
  credit.mintTxHash = event.transaction.hash;
  credit.lastUpdated = event.block.timestamp;

  // Link to verification batch if available
  // Note: batchId would need to be indexed from a different event

  credit.save();

  // Update user stats
  let user = getOrCreateUser(recipient);
  user.totalCreditsMinted = user.totalCreditsMinted.plus(event.params.co2AmountKg);
  user.totalCreditsOwned = user.totalCreditsOwned.plus(event.params.co2AmountKg);
  user.totalCO2Captured = user.totalCO2Captured.plus(capturedAmount);
  user.lastActive = event.block.timestamp;
  if (user.firstSeen.equals(BigInt.fromI32(0))) {
    user.firstSeen = event.block.timestamp;
  }
  user.save();

  // Create provenance event
  let provenanceId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let provenance = new ProvenanceEvent(provenanceId);
  provenance.credit = creditId;
  provenance.eventType = "MINTED";
  provenance.actor = user.id;
  provenance.description = "Carbon credit minted from verified capture data";
  provenance.dataHash = event.params.sourceDataHash;
  provenance.timestamp = event.block.timestamp;
  provenance.txHash = event.transaction.hash;
  provenance.blockNumber = event.block.number;
  provenance.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.creditsMinted = dailyStats.creditsMinted.plus(event.params.co2AmountKg);
  dailyStats.mintTransactions = dailyStats.mintTransactions + 1;
  dailyStats.save();

  // Update global stats
  let marketStats = getOrCreateMarketStats();
  marketStats.totalCreditsMinted = marketStats.totalCreditsMinted.plus(event.params.co2AmountKg);
  marketStats.totalCreditsActive = marketStats.totalCreditsActive.plus(event.params.co2AmountKg);
  marketStats.totalCO2Captured = marketStats.totalCO2Captured.plus(capturedAmount);
  marketStats.lastUpdated = event.block.timestamp;
  marketStats.save();
}

// Handle CreditRetired event
export function handleCreditRetired(event: CreditRetired): void {
  let creditId = event.params.tokenId.toString();
  let credit = CarbonCredit.load(creditId);

  if (credit != null) {
    credit.status = "RETIRED";
    credit.retiredAt = event.block.timestamp;
    credit.retiredBy = event.params.retiredBy.toHexString();
    credit.retirementReason = event.params.retirementReason;
    credit.lastUpdated = event.block.timestamp;
    credit.save();

    // Update user stats
    let user = getOrCreateUser(event.params.retiredBy);
    user.totalCreditsRetired = user.totalCreditsRetired.plus(event.params.amount);
    user.totalCreditsOwned = user.totalCreditsOwned.minus(event.params.amount);
    user.lastActive = event.block.timestamp;
    user.save();

    // Create provenance event
    let provenanceId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    let provenance = new ProvenanceEvent(provenanceId);
    provenance.credit = creditId;
    provenance.eventType = "RETIRED";
    provenance.actor = user.id;
    provenance.description = event.params.retirementReason;
    provenance.timestamp = event.block.timestamp;
    provenance.txHash = event.transaction.hash;
    provenance.blockNumber = event.block.number;
    provenance.save();

    // Update daily stats
    let dailyStats = getOrCreateDailyStats(event.block.timestamp);
    dailyStats.creditsRetired = dailyStats.creditsRetired.plus(event.params.amount);
    dailyStats.retirementTransactions = dailyStats.retirementTransactions + 1;
    dailyStats.save();

    // Update global stats
    let marketStats = getOrCreateMarketStats();
    marketStats.totalCreditsRetired = marketStats.totalCreditsRetired.plus(event.params.amount);
    marketStats.totalCreditsActive = marketStats.totalCreditsActive.minus(event.params.amount);
    marketStats.totalCO2Retired = marketStats.totalCO2Retired.plus(event.params.amount);
    marketStats.lastUpdated = event.block.timestamp;
    marketStats.save();
  }
}

// Handle TransferSingle event
export function handleTransferSingle(event: TransferSingle): void {
  let creditId = event.params.id.toString();
  let credit = CarbonCredit.load(creditId);

  if (credit != null) {
    // Update ownership
    let fromUser = getOrCreateUser(event.params.from);
    let toUser = getOrCreateUser(event.params.to);

    // Update from user (if not minting)
    if (event.params.from.toHexString() != "0x0000000000000000000000000000000000000000") {
      fromUser.totalCreditsOwned = fromUser.totalCreditsOwned.minus(event.params.value);
      fromUser.lastActive = event.block.timestamp;
      fromUser.save();
    }

    // Update to user (if not burning)
    if (event.params.to.toHexString() != "0x0000000000000000000000000000000000000000") {
      toUser.totalCreditsOwned = toUser.totalCreditsOwned.plus(event.params.value);
      toUser.lastActive = event.block.timestamp;
      if (toUser.firstSeen.equals(BigInt.fromI32(0))) {
        toUser.firstSeen = event.block.timestamp;
      }
      toUser.save();

      credit.owner = toUser.id;
      credit.lastUpdated = event.block.timestamp;
      credit.save();
    }

    // Create provenance event for transfers (not mint/burn)
    if (
      event.params.from.toHexString() != "0x0000000000000000000000000000000000000000" &&
      event.params.to.toHexString() != "0x0000000000000000000000000000000000000000"
    ) {
      let provenanceId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
      let provenance = new ProvenanceEvent(provenanceId);
      provenance.credit = creditId;
      provenance.eventType = "TRANSFERRED";
      provenance.actor = event.params.from.toHexString();
      provenance.description = "Credit transferred to " + event.params.to.toHexString();
      provenance.timestamp = event.block.timestamp;
      provenance.txHash = event.transaction.hash;
      provenance.blockNumber = event.block.number;
      provenance.save();
    }
  }
}

// Handle TransferBatch event
export function handleTransferBatch(event: TransferBatch): void {
  let ids = event.params.ids;
  let values = event.params.values;

  for (let i = 0; i < ids.length; i++) {
    let creditId = ids[i].toString();
    let credit = CarbonCredit.load(creditId);

    if (credit != null) {
      // Update from user
      if (event.params.from.toHexString() != "0x0000000000000000000000000000000000000000") {
        let fromUser = getOrCreateUser(event.params.from);
        fromUser.totalCreditsOwned = fromUser.totalCreditsOwned.minus(values[i]);
        fromUser.lastActive = event.block.timestamp;
        fromUser.save();
      }

      // Update to user
      if (event.params.to.toHexString() != "0x0000000000000000000000000000000000000000") {
        let toUser = getOrCreateUser(event.params.to);
        toUser.totalCreditsOwned = toUser.totalCreditsOwned.plus(values[i]);
        toUser.lastActive = event.block.timestamp;
        toUser.save();

        credit.owner = toUser.id;
        credit.lastUpdated = event.block.timestamp;
        credit.save();
      }
    }
  }
}
