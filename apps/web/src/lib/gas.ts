/**
 * Gas-limit buffering for the Aethelred EVM.
 *
 * The Aethelred node's `eth_estimateGas` under-reports gas for state-changing
 * calls — it returns roughly the intrinsic cost — so submitting the raw
 * estimate as the gas limit makes every contract write revert out-of-gas.
 * We buffer the estimate, floor it so a near-intrinsic estimate still clears a
 * real storage-touching call, and cap it so a pathological estimate cannot
 * exceed the block limit. Unused gas is refunded by the Cosmos fee market, so
 * over-estimating the LIMIT is free.
 */

export const GAS_BUFFER_MULTIPLIER = 8n;
export const GAS_FLOOR = 700_000n;
export const GAS_CEILING = 30_000_000n;

export function bufferGasLimit(estimate: bigint): bigint {
  const buffered = estimate * GAS_BUFFER_MULTIPLIER;
  const floored = buffered > GAS_FLOOR ? buffered : GAS_FLOOR;
  return floored > GAS_CEILING ? GAS_CEILING : floored;
}
