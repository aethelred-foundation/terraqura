import {
  afterAll,
  assert,
  clearStore,
  createMockedFunction,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import { CreditMinted, CreditRetired } from "../generated/CarbonCredit/CarbonCredit";
import { handleCreditMinted, handleCreditRetired } from "../src/carbon-credit";

const CONTRACT_ADDRESS = Address.fromString("0x1000000000000000000000000000000000000001");
const OPERATOR = Address.fromString("0x3000000000000000000000000000000000000003");
const SOURCE_HASH_HEX = "0x1111111111111111111111111111111111111111111111111111111111111111";
const DAC_UNIT_ID_HEX = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MINT_TX_HASH_HEX = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1";
const RETIRE_TX_HASH_HEX = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb01";
const DAY_BUCKET_ID = "1699920000";
const GET_CREDIT_PROVENANCE_SIGNATURE =
  "getCreditProvenance(uint256):((bytes32,bytes32,uint256,uint256,uint256,int256,int256,uint8,uint256,bool,string,string),(bool,bool,bool,uint256,uint256))";

function bytes32(hex: string): Bytes {
  return Bytes.fromHexString(hex) as Bytes;
}

function mockCreditProvenanceRevert(tokenId: i32): void {
  createMockedFunction(
    CONTRACT_ADDRESS,
    "getCreditProvenance",
    GET_CREDIT_PROVENANCE_SIGNATURE,
  )
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))])
    .reverts();
}

function createCreditMintedEvent(
  tokenId: i32,
  amountKg: i32,
  timestamp: i32,
): CreditMinted {
  const event = changetype<CreditMinted>(newMockEvent());
  event.address = CONTRACT_ADDRESS;
  event.block.number = BigInt.fromI32(12345);
  event.block.timestamp = BigInt.fromI32(timestamp);
  event.transaction.hash = bytes32(MINT_TX_HASH_HEX);
  event.transaction.from = OPERATOR;
  event.logIndex = BigInt.fromI32(1);

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))),
  );
  event.parameters.push(
    new ethereum.EventParam("dacUnitId", ethereum.Value.fromFixedBytes(bytes32(DAC_UNIT_ID_HEX))),
  );
  event.parameters.push(
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(OPERATOR)),
  );
  event.parameters.push(
    new ethereum.EventParam("co2AmountKg", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amountKg))),
  );
  event.parameters.push(
    new ethereum.EventParam("sourceDataHash", ethereum.Value.fromFixedBytes(bytes32(SOURCE_HASH_HEX))),
  );

  return event;
}

function createCreditRetiredEvent(
  tokenId: i32,
  amountKg: i32,
  reason: string,
  timestamp: i32,
): CreditRetired {
  const event = changetype<CreditRetired>(newMockEvent());
  event.address = CONTRACT_ADDRESS;
  event.block.number = BigInt.fromI32(12346);
  event.block.timestamp = BigInt.fromI32(timestamp);
  event.transaction.hash = bytes32(RETIRE_TX_HASH_HEX);
  event.transaction.from = OPERATOR;
  event.logIndex = BigInt.fromI32(2);

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))),
  );
  event.parameters.push(
    new ethereum.EventParam("retiredBy", ethereum.Value.fromAddress(OPERATOR)),
  );
  event.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amountKg))),
  );
  event.parameters.push(
    new ethereum.EventParam("retirementReason", ethereum.Value.fromString(reason)),
  );

  return event;
}

describe("carbon-credit mappings", () => {
  test("handleCreditMinted creates credit, user and aggregate stats", () => {
    clearStore();

    mockCreditProvenanceRevert(1);
    const event = createCreditMintedEvent(1, 1000, 1700000060);
    handleCreditMinted(event);

    assert.entityCount("CarbonCredit", 1);
    assert.entityCount("User", 1);
    assert.entityCount("ProvenanceEvent", 1);
    assert.entityCount("MarketStats", 1);
    assert.entityCount("DailyStats", 1);

    assert.fieldEquals("CarbonCredit", "1", "owner", OPERATOR.toHexString());
    assert.fieldEquals("CarbonCredit", "1", "amount", "1000");
    assert.fieldEquals("CarbonCredit", "1", "status", "ACTIVE");
    assert.fieldEquals("CarbonCredit", "1", "dataHash", SOURCE_HASH_HEX);

    assert.fieldEquals("User", OPERATOR.toHexString(), "totalCreditsOwned", "1000");
    assert.fieldEquals("User", OPERATOR.toHexString(), "totalCreditsMinted", "1000");

    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "creditsMinted", "1000");
    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "mintTransactions", "1");

    assert.fieldEquals("MarketStats", "global", "totalCreditsMinted", "1000");
    assert.fieldEquals("MarketStats", "global", "totalCreditsActive", "1000");
    assert.fieldEquals("MarketStats", "global", "totalCO2Captured", "1000");
  });

  test("handleCreditRetired marks credit retired and updates totals", () => {
    clearStore();

    mockCreditProvenanceRevert(2);
    handleCreditMinted(createCreditMintedEvent(2, 1000, 1700000060));
    handleCreditRetired(
      createCreditRetiredEvent(2, 400, "Corporate offset retirement", 1700000360),
    );

    assert.entityCount("CarbonCredit", 1);
    assert.entityCount("ProvenanceEvent", 2);

    assert.fieldEquals("CarbonCredit", "2", "status", "RETIRED");
    assert.fieldEquals("CarbonCredit", "2", "retiredBy", OPERATOR.toHexString());
    assert.fieldEquals("CarbonCredit", "2", "retirementReason", "Corporate offset retirement");

    assert.fieldEquals("User", OPERATOR.toHexString(), "totalCreditsRetired", "400");
    assert.fieldEquals("User", OPERATOR.toHexString(), "totalCreditsOwned", "600");

    assert.fieldEquals("MarketStats", "global", "totalCreditsRetired", "400");
    assert.fieldEquals("MarketStats", "global", "totalCreditsActive", "600");
    assert.fieldEquals("MarketStats", "global", "totalCO2Retired", "400");
  });

  afterAll(() => {
    clearStore();
  });
});
