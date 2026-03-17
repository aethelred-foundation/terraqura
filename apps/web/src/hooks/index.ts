// Export all contract data hooks
export {
  useSystemStatus,
  useContractOperational,
  useCarbonCredit,
  useVerificationResult,
  useCreditBalance,
  useTotalCreditsMinted,
  useTotalCreditsRetired,
  useMarketplaceListing,
  usePlatformStats,
  useGovernanceStats,
  useHasRole,
  useDacWhitelisted,
  useVerificationThresholds,
  useWatchCreditMints,
  useWatchMarketplaceSales,
  useWatchEmergencyEvents,
  useDashboardData,
  useNextTokenId,
  useOracleSensorData,
  useOracleDataFreshness,
  useOracleDevices,
  useWatchOracleData,
  useWatchOracleAnomalies,
  type SystemStatus,
  type CarbonCreditData,
  type VerificationResult,
  type MarketplaceListing,
  type GovernanceStats,
  type PlatformStats,
  type ContractEventLog,
  type OracleSensorData,
  type OracleDeviceStatus,
} from "./useContractData";

// Export KYC hooks
export {
  useKycStatus,
  type KycState,
  type KycStatus,
  type UseKycStatusReturn,
} from "./useKycStatus";

// Export scroll animation hooks
export {
  useScrollAnimation,
  useParallax,
  useRevealAnimation,
  useStaggerReveal,
  useCountUp,
  useTextReveal,
  useSmoothScroll,
} from "./useScrollAnimation";
