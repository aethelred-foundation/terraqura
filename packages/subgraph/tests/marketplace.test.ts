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

import { CreditMinted } from "../generated/CarbonCredit/CarbonCredit";
import {
  ListingCreated,
  OfferAccepted,
  OfferCreated,
  PlatformFeeUpdated,
  Purchase as PurchaseEvent,
} from "../generated/CarbonMarketplace/CarbonMarketplace";
import { handleCreditMinted } from "../src/carbon-credit";
import {
  handleListingCreated,
  handleOfferAccepted,
  handleOfferCreated,
  handlePlatformFeeUpdated,
  handlePurchase,
} from "../src/marketplace";

const CREDIT_CONTRACT = Address.fromString("0x1000000000000000000000000000000000000001");
const MARKETPLACE_CONTRACT = Address.fromString("0x5000000000000000000000000000000000000005");
const SELLER = Address.fromString("0x6000000000000000000000000000000000000006");
const BUYER = Address.fromString("0x7000000000000000000000000000000000000007");
const SOURCE_HASH_HEX = "0x4444444444444444444444444444444444444444444444444444444444444444";
const DAC_UNIT_ID_HEX = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const DAY_BUCKET_ID = "1699920000";
const GET_CREDIT_PROVENANCE_SIGNATURE =
  "getCreditProvenance(uint256):((bytes32,bytes32,uint256,uint256,uint256,int256,int256,uint8,uint256,bool,string,string),(bool,bool,bool,uint256,uint256))";

function bytes32(hex: string): Bytes {
  return Bytes.fromHexString(hex) as Bytes;
}

function seedCredit(tokenId: i32, amountKg: i32): void {
  createMockedFunction(
    CREDIT_CONTRACT,
    "getCreditProvenance",
    GET_CREDIT_PROVENANCE_SIGNATURE,
  )
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))])
    .reverts();

  const mintEvent = changetype<CreditMinted>(newMockEvent());
  mintEvent.address = CREDIT_CONTRACT;
  mintEvent.block.number = BigInt.fromI32(30000);
  mintEvent.block.timestamp = BigInt.fromI32(1700000060);
  mintEvent.transaction.hash = bytes32(
    "0x5100000000000000000000000000000000000000000000000000000000000001",
  );
  mintEvent.transaction.from = SELLER;
  mintEvent.logIndex = BigInt.fromI32(1);

  mintEvent.parameters = new Array();
  mintEvent.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))),
  );
  mintEvent.parameters.push(
    new ethereum.EventParam("dacUnitId", ethereum.Value.fromFixedBytes(bytes32(DAC_UNIT_ID_HEX))),
  );
  mintEvent.parameters.push(
    new ethereum.EventParam("operator", ethereum.Value.fromAddress(SELLER)),
  );
  mintEvent.parameters.push(
    new ethereum.EventParam("co2AmountKg", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amountKg))),
  );
  mintEvent.parameters.push(
    new ethereum.EventParam("sourceDataHash", ethereum.Value.fromFixedBytes(bytes32(SOURCE_HASH_HEX))),
  );

  handleCreditMinted(mintEvent);
}

function createListingCreatedEvent(
  listingId: i32,
  tokenId: i32,
  amount: i32,
  pricePerUnit: i32,
): ListingCreated {
  const event = changetype<ListingCreated>(newMockEvent());
  event.address = MARKETPLACE_CONTRACT;
  event.block.number = BigInt.fromI32(30001);
  event.block.timestamp = BigInt.fromI32(1700000120);
  event.transaction.hash = bytes32(
    "0x5200000000000000000000000000000000000000000000000000000000000001",
  );
  event.transaction.from = SELLER;
  event.logIndex = BigInt.fromI32(1);

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("listingId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(listingId))),
  );
  event.parameters.push(
    new ethereum.EventParam("seller", ethereum.Value.fromAddress(SELLER)),
  );
  event.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))),
  );
  event.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pricePerUnit",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(pricePerUnit)),
    ),
  );

  return event;
}

function createPurchaseEvent(
  listingId: i32,
  tokenId: i32,
  amount: i32,
  totalPrice: i32,
  platformFee: i32,
): PurchaseEvent {
  const event = changetype<PurchaseEvent>(newMockEvent());
  event.address = MARKETPLACE_CONTRACT;
  event.block.number = BigInt.fromI32(30002);
  event.block.timestamp = BigInt.fromI32(1700000180);
  event.transaction.hash = bytes32(
    "0x5300000000000000000000000000000000000000000000000000000000000001",
  );
  event.transaction.from = BUYER;
  event.logIndex = BigInt.fromI32(2);

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("listingId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(listingId))),
  );
  event.parameters.push(
    new ethereum.EventParam("buyer", ethereum.Value.fromAddress(BUYER)),
  );
  event.parameters.push(
    new ethereum.EventParam("seller", ethereum.Value.fromAddress(SELLER)),
  );
  event.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))),
  );
  event.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "totalPrice",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(totalPrice)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "platformFee",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(platformFee)),
    ),
  );

  return event;
}

function createOfferCreatedEvent(
  offerId: i32,
  tokenId: i32,
  amount: i32,
  pricePerUnit: i32,
): OfferCreated {
  const event = changetype<OfferCreated>(newMockEvent());
  event.address = MARKETPLACE_CONTRACT;
  event.block.number = BigInt.fromI32(30003);
  event.block.timestamp = BigInt.fromI32(1700000240);
  event.transaction.hash = bytes32(
    "0x5400000000000000000000000000000000000000000000000000000000000001",
  );
  event.transaction.from = BUYER;
  event.logIndex = BigInt.fromI32(1);

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("offerId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(offerId))),
  );
  event.parameters.push(
    new ethereum.EventParam("buyer", ethereum.Value.fromAddress(BUYER)),
  );
  event.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))),
  );
  event.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "pricePerUnit",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(pricePerUnit)),
    ),
  );

  return event;
}

function createPlatformFeeUpdatedEvent(oldFee: i32, newFee: i32): PlatformFeeUpdated {
  const event = changetype<PlatformFeeUpdated>(newMockEvent());
  event.address = MARKETPLACE_CONTRACT;
  event.block.number = BigInt.fromI32(30004);
  event.block.timestamp = BigInt.fromI32(1700000300);
  event.transaction.hash = bytes32(
    "0x5500000000000000000000000000000000000000000000000000000000000001",
  );
  event.transaction.from = SELLER;
  event.logIndex = BigInt.fromI32(2);

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("oldFee", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(oldFee))),
  );
  event.parameters.push(
    new ethereum.EventParam("newFee", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newFee))),
  );

  return event;
}

function createOfferAcceptedEvent(
  offerId: i32,
  tokenId: i32,
  amount: i32,
  totalPrice: i32,
): OfferAccepted {
  const event = changetype<OfferAccepted>(newMockEvent());
  event.address = MARKETPLACE_CONTRACT;
  event.block.number = BigInt.fromI32(30005);
  event.block.timestamp = BigInt.fromI32(1700000360);
  event.transaction.hash = bytes32(
    "0x5600000000000000000000000000000000000000000000000000000000000001",
  );
  event.transaction.from = SELLER;
  event.logIndex = BigInt.fromI32(3);

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("offerId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(offerId))),
  );
  event.parameters.push(
    new ethereum.EventParam("seller", ethereum.Value.fromAddress(SELLER)),
  );
  event.parameters.push(
    new ethereum.EventParam("buyer", ethereum.Value.fromAddress(BUYER)),
  );
  event.parameters.push(
    new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(tokenId))),
  );
  event.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(amount))),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "totalPrice",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(totalPrice)),
    ),
  );

  return event;
}

describe("marketplace mappings", () => {
  test("handles listing creation and full purchase settlement", () => {
    clearStore();

    seedCredit(42, 10);
    handleListingCreated(createListingCreatedEvent(1, 42, 10, 2));
    handlePurchase(createPurchaseEvent(1, 42, 10, 20, 1));

    const listingId = "1";
    const purchaseId =
      "0x5300000000000000000000000000000000000000000000000000000000000001-2";

    assert.entityCount("Listing", 1);
    assert.entityCount("Purchase", 1);

    assert.fieldEquals("Listing", listingId, "status", "SOLD");
    assert.fieldEquals("Listing", listingId, "amountRemaining", "0");
    assert.fieldEquals("Listing", listingId, "seller", SELLER.toHexString());
    assert.fieldEquals("Listing", listingId, "credit", "42");

    assert.fieldEquals("Purchase", purchaseId, "buyer", BUYER.toHexString());
    assert.fieldEquals("Purchase", purchaseId, "seller", SELLER.toHexString());
    assert.fieldEquals("Purchase", purchaseId, "totalPrice", "20");
    assert.fieldEquals("Purchase", purchaseId, "platformFee", "1");

    assert.fieldEquals("CarbonCredit", "42", "owner", BUYER.toHexString());
    assert.fieldEquals("CarbonCredit", "42", "status", "ACTIVE");

    assert.fieldEquals("User", BUYER.toHexString(), "totalVolumeBought", "20");
    assert.fieldEquals("User", SELLER.toHexString(), "totalVolumeSold", "20");

    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "newListings", "1");
    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "tradeTransactions", "1");
    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "volumeTraded", "20");

    assert.fieldEquals("MarketStats", "global", "activeListings", "0");
    assert.fieldEquals("MarketStats", "global", "totalListings", "1");
    assert.fieldEquals("MarketStats", "global", "totalTransactions", "1");
    assert.fieldEquals("MarketStats", "global", "totalVolumeTraded", "20");
  });

  test("uses dynamic platform fee from PlatformFeeUpdated for offer acceptance", () => {
    clearStore();

    handleOfferCreated(createOfferCreatedEvent(9, 77, 5, 4));
    handlePlatformFeeUpdated(createPlatformFeeUpdatedEvent(250, 500));
    handleOfferAccepted(createOfferAcceptedEvent(9, 77, 5, 20));

    const purchaseId =
      "0x5600000000000000000000000000000000000000000000000000000000000001-3";

    assert.entityCount("Offer", 1);
    assert.entityCount("Purchase", 1);

    assert.fieldEquals("Offer", "9", "status", "ACCEPTED");
    assert.fieldEquals("Offer", "9", "acceptedBy", SELLER.toHexString());

    // totalPrice=20, currentFeeBps=500 => fee = 1
    assert.fieldEquals("Purchase", purchaseId, "platformFee", "1");
    assert.fieldEquals("MarketStats", "global", "currentFeeBps", "500");
    assert.fieldEquals("MarketStats", "global", "activeOffers", "0");
  });

  afterAll(() => {
    clearStore();
  });
});
