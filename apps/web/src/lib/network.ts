import {
  ACTIVE_NETWORK,
  getExplorerAddressUrl as getAddressUrl,
  getExplorerTokenUrl as getTokenUrl,
  getExplorerTxUrl as getTxUrl,
  SUPPORTED_CHAINS,
} from "@/lib/wagmi";

export { ACTIVE_NETWORK, SUPPORTED_CHAINS };

export function getExplorerTxUrl(txHash: string, _chainId?: number): string {
  return getTxUrl(txHash);
}

export function getExplorerAddressUrl(
  address: string,
  _chainId?: number,
): string {
  return getAddressUrl(address);
}

export function getExplorerTokenUrl(
  address: string,
  tokenId?: string,
  _chainId?: number,
): string {
  return getTokenUrl(address, tokenId);
}
