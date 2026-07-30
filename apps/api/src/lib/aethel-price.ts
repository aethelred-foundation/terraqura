export function weiToUsd(
  wei: string,
  configuredAethelUsdPrice = process.env.AETHEL_USD_PRICE,
): number | null {
  if (!configuredAethelUsdPrice?.trim()) {
    return null;
  }
  const aethelUsd = Number(configuredAethelUsdPrice);
  const aethel = Number(wei) / 1e18;
  return Number.isFinite(aethelUsd) && aethelUsd > 0 && Number.isFinite(aethel)
    ? aethel * aethelUsd
    : null;
}
