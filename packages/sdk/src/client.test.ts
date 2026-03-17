import { describe, expect, it } from "vitest";

import { TerraQuraClient } from "./client.js";
import { ValidationError } from "./errors.js";

describe("TerraQuraClient", () => {
  it("constructs in read-only mode and exposes module accessors", () => {
    const client = new TerraQuraClient({ network: "aethelred-testnet" });

    expect(client.network).toBe("aethelred-testnet");
    expect(client.isReadOnly()).toBe(true);
    expect(client.signer).toBeNull();
    expect(client.address).toBeNull();

    expect(client.assets).toBeDefined();
    expect(client.market).toBeDefined();
    expect(client.mrv).toBeDefined();
    expect(client.offset).toBeDefined();
    expect(client.connect).toBeDefined();
  });

  it("throws ValidationError for invalid configuration", () => {
    expect(() => {
      new TerraQuraClient({
        // @ts-expect-error intentional invalid value for runtime validation test
        network: "invalid-network",
      });
    }).toThrow(ValidationError);
  });
});
