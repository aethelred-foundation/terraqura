import { randomBytes, randomInt } from "node:crypto";

const HEX_PATTERN = /^[a-f0-9]+$/;

export function generateId(prefix: string, bytes = 12): string {
  if (!/^[a-z][a-z0-9_:-]*$/i.test(prefix)) {
    throw new Error(`Invalid identifier prefix: ${prefix}`);
  }

  return `${prefix}_${randomBytes(bytes).toString("hex")}`;
}

export function generateBytes32(): `0x${string}` {
  return `0x${randomBytes(32).toString("hex")}`;
}

export function generateTxHash(): `0x${string}` {
  return generateBytes32();
}

export function generateSimulatedBlockNumber(
  baseBlock = 50_000_000,
  range = 1_000_000
): number {
  if (!Number.isSafeInteger(baseBlock) || baseBlock < 0) {
    throw new Error("baseBlock must be a non-negative safe integer");
  }

  if (!Number.isSafeInteger(range) || range <= 0) {
    throw new Error("range must be a positive safe integer");
  }

  return baseBlock + randomInt(range);
}

export function isHexIdentifier(value: string, bytes: number): boolean {
  return value.length === bytes * 2 && HEX_PATTERN.test(value);
}
