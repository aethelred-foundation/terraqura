let fallbackState = 0x9e3779b9;
let fallbackCounter = 0;

function nextFallbackUint32(): number {
  fallbackCounter += 1;
  fallbackState = (fallbackState + 0x6d2b79f5 + fallbackCounter) >>> 0;
  let value = fallbackState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return (value ^ (value >>> 14)) >>> 0;
}

export function cryptoRandomUint32(): number {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return values[0] ?? 0;
  }

  return nextFallbackUint32();
}

export function cryptoRandomFloat(): number {
  return cryptoRandomUint32() / 0x100000000;
}

export function cryptoRandomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("cryptoRandomInt requires a positive safe integer maxExclusive");
  }

  return Math.floor(cryptoRandomFloat() * maxExclusive);
}

export function cryptoRandomChar(alphabet: string): string {
  if (alphabet.length === 0) {
    throw new RangeError("cryptoRandomChar requires a non-empty alphabet");
  }

  return alphabet[cryptoRandomInt(alphabet.length)] as string;
}

export function cryptoRandomHex(byteLength: number): string {
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
    throw new RangeError("cryptoRandomHex requires a positive safe integer byteLength");
  }

  const bytes = new Uint8Array(byteLength);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = cryptoRandomInt(256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
