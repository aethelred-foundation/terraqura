export const TERRAQURA_TERMS_VERSION = "1.0.0";

/**
 * SHA-256 of the canonical v1.0.0 terms document shipped at /terms.
 *
 * A new terms version must use a new digest so a wallet signature can never be
 * replayed as acceptance of materially different terms.
 */
export const TERRAQURA_TERMS_HASH =
  "0xb411efc895faf4ba3d0524cb44d850baa4668a6469ffc80100e857bde9007de4";

export interface TermsAcceptancePayload {
  walletAddress: string;
  signature: string;
  message: string;
  version: string;
  termsHash: string;
  acceptedAt: string;
}

export function buildTermsAcceptanceMessage(
  walletAddress: string,
  acceptedAt: string,
): string {
  return [
    `I, the owner of wallet ${walletAddress}, agree to the TerraQura Terms of Service (Version ${TERRAQURA_TERMS_VERSION}).`,
    "",
    `Timestamp: ${acceptedAt}`,
    `Terms Hash: ${TERRAQURA_TERMS_HASH}`,
  ].join("\n");
}
