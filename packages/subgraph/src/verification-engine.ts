// TerraQura Verification Engine Subgraph Mappings

import { Address, BigInt } from "@graphprotocol/graph-ts";
import { VerificationPhaseCompleted } from "../generated/VerificationEngine/VerificationEngine";
import {
  DailyStats,
  MarketStats,
  User,
  VerificationBatch,
  VerificationPhase,
} from "../generated/schema";

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

    let stats = getOrCreateMarketStats();
    stats.totalUsers = stats.totalUsers + 1;
    stats.totalOperators = stats.totalOperators + 1;
    stats.save();
  }

  return user;
}

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

export function handleVerificationPhaseCompleted(event: VerificationPhaseCompleted): void {
  let batchId = event.params.sourceDataHash.toHexString();
  let phaseName = event.params.phase;
  let isNewBatch = false;

  let batch = VerificationBatch.load(batchId);
  if (batch == null) {
    isNewBatch = true;
    batch = new VerificationBatch(batchId);
    batch.operator = event.transaction.from.toHexString();
    batch.co2Amount = BigInt.fromI32(0);
    batch.efficiencyFactor = BigInt.fromI32(0);
    batch.dataHash = event.params.sourceDataHash;
    batch.currentPhase = "PENDING";
    batch.status = "PENDING";
    batch.passed = false;
    batch.submittedAt = event.block.timestamp;
    batch.txHash = event.transaction.hash;
  }

  // Track phase-level progress.
  batch.currentPhase = phaseName;
  if (phaseName == "SOURCE") {
    batch.sourceCheckPassed = event.params.passed;
    batch.status = event.params.passed ? "SOURCE_CHECK" : "FAILED";
  } else if (phaseName == "LOGIC") {
    batch.logicCheckPassed = event.params.passed;
    batch.status = event.params.passed ? "LOGIC_CHECK" : "FAILED";
  } else if (phaseName == "MINT") {
    batch.mintCheckPassed = event.params.passed;
    batch.status = event.params.passed ? "MINT_CHECK" : "FAILED";
  }

  // Terminal states:
  // - Any failed phase
  // - Successful MINT phase (all checks passed)
  let isTerminal = !event.params.passed || phaseName == "MINT";
  if (isTerminal) {
    batch.completedAt = event.block.timestamp;
    if (event.params.passed && phaseName == "MINT") {
      batch.passed = true;
      batch.status = "VERIFIED";
    } else {
      batch.passed = false;
      batch.status = "FAILED";
    }
  }

  batch.save();

  // Keep operator activity current using tx sender for this verification transaction.
  let operator = getOrCreateUser(event.transaction.from);
  operator.lastActive = event.block.timestamp;
  if (operator.firstSeen.equals(BigInt.fromI32(0))) {
    operator.firstSeen = event.block.timestamp;
  }
  operator.save();

  // Phase record
  let phaseId = batchId + "-" + phaseName + "-" + event.logIndex.toString();
  let phase = new VerificationPhase(phaseId);
  phase.batch = batchId;
  phase.phase = phaseName.toLowerCase();
  phase.passed = event.params.passed;
  phase.timestamp = event.block.timestamp;
  phase.txHash = event.transaction.hash;
  phase.save();

  // Aggregate stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  if (isNewBatch) {
    dailyStats.verificationsSubmitted = dailyStats.verificationsSubmitted + 1;
  }
  if (isTerminal) {
    dailyStats.verificationsCompleted = dailyStats.verificationsCompleted + 1;
    if (event.params.passed && phaseName == "MINT") {
      dailyStats.verificationsPassed = dailyStats.verificationsPassed + 1;
    }
  }
  dailyStats.save();

  let marketStats = getOrCreateMarketStats();
  marketStats.lastUpdated = event.block.timestamp;
  marketStats.save();
}
