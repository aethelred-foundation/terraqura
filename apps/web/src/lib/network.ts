import { aethelred, aethelredTestnet } from "@/lib/wagmi";

const isDevelopment = process.env.NODE_ENV === "development";
const isTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === "true" || isDevelopment;

export const SUPPORTED_CHAINS = {
  aethelred: {
    id: aethelred.id,
    name: aethelred.name,
    isTestnet: false,
    explorerUrl: "https://explorer.aethelred.network",
    nativeCurrency: aethelred.nativeCurrency,
  },
  aethelredTestnet: {
    id: aethelredTestnet.id,
    name: aethelredTestnet.name,
    isTestnet: true,
    explorerUrl: "https://testnet-explorer.aethelred.network",
    nativeCurrency: aethelredTestnet.nativeCurrency,
  },
} as const;

export const ACTIVE_NETWORK = isTestnet
  ? SUPPORTED_CHAINS.aethelredTestnet
  : SUPPORTED_CHAINS.aethelred;

export function getExplorerTxUrl(txHash: string, chainId?: number): string {
  const chain =
    chainId === aethelred.id
      ? SUPPORTED_CHAINS.aethelred
      : SUPPORTED_CHAINS.aethelredTestnet;
  return `${chain.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string, chainId?: number): string {
  const chain =
    chainId === aethelred.id
      ? SUPPORTED_CHAINS.aethelred
      : SUPPORTED_CHAINS.aethelredTestnet;
  return `${chain.explorerUrl}/address/${address}`;
}

export function getExplorerTokenUrl(
  address: string,
  tokenId?: string,
  chainId?: number
): string {
  const chain =
    chainId === aethelred.id
      ? SUPPORTED_CHAINS.aethelred
      : SUPPORTED_CHAINS.aethelredTestnet;
  const url = new URL(`/token/${address}`, chain.explorerUrl);
  if (tokenId) {
    url.searchParams.set("a", tokenId);
  }
  return url.toString();
}
