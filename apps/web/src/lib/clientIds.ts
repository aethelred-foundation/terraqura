let fallbackCounter = 0;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createClientId(prefix = "id"): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.randomUUID) {
    return `${prefix}-${cryptoApi.randomUUID()}`;
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return `${prefix}-${bytesToHex(bytes)}`;
  }

  fallbackCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
}
