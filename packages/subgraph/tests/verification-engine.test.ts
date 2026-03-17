import {
  afterAll,
  assert,
  clearStore,
  describe,
  newMockEvent,
  test,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

import { VerificationPhaseCompleted } from "../generated/VerificationEngine/VerificationEngine";
import { handleVerificationPhaseCompleted } from "../src/verification-engine";

const CONTRACT_ADDRESS = Address.fromString("0x2000000000000000000000000000000000000002");
const OPERATOR = Address.fromString("0x4000000000000000000000000000000000000004");
const DAC_UNIT_ID_HEX = "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const SOURCE_HASH_HEX = "0x2222222222222222222222222222222222222222222222222222222222222222";
const FAILING_SOURCE_HASH_HEX = "0x3333333333333333333333333333333333333333333333333333333333333333";
const DAY_BUCKET_ID = "1699920000";

function bytes32(hex: string): Bytes {
  return Bytes.fromHexString(hex) as Bytes;
}

function createVerificationPhaseCompletedEvent(
  sourceDataHashHex: string,
  phase: string,
  passed: boolean,
  reason: string,
  txHashHex: string,
  logIndex: i32,
  timestamp: i32,
): VerificationPhaseCompleted {
  const event = changetype<VerificationPhaseCompleted>(newMockEvent());
  event.address = CONTRACT_ADDRESS;
  event.block.number = BigInt.fromI32(22222);
  event.block.timestamp = BigInt.fromI32(timestamp);
  event.transaction.hash = bytes32(txHashHex);
  event.transaction.from = OPERATOR;
  event.logIndex = BigInt.fromI32(logIndex);

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam("dacUnitId", ethereum.Value.fromFixedBytes(bytes32(DAC_UNIT_ID_HEX))),
  );
  event.parameters.push(
    new ethereum.EventParam(
      "sourceDataHash",
      ethereum.Value.fromFixedBytes(bytes32(sourceDataHashHex)),
    ),
  );
  event.parameters.push(
    new ethereum.EventParam("phase", ethereum.Value.fromString(phase)),
  );
  event.parameters.push(
    new ethereum.EventParam("passed", ethereum.Value.fromBoolean(passed)),
  );
  event.parameters.push(
    new ethereum.EventParam("reason", ethereum.Value.fromString(reason)),
  );

  return event;
}

describe("verification-engine mappings", () => {
  test("tracks full successful SOURCE->LOGIC->MINT lifecycle", () => {
    clearStore();

    handleVerificationPhaseCompleted(
      createVerificationPhaseCompletedEvent(
        SOURCE_HASH_HEX,
        "SOURCE",
        true,
        "source-ok",
        "0x4100000000000000000000000000000000000000000000000000000000000001",
        1,
        1700000060,
      ),
    );

    handleVerificationPhaseCompleted(
      createVerificationPhaseCompletedEvent(
        SOURCE_HASH_HEX,
        "LOGIC",
        true,
        "logic-ok",
        "0x4100000000000000000000000000000000000000000000000000000000000002",
        2,
        1700000120,
      ),
    );

    handleVerificationPhaseCompleted(
      createVerificationPhaseCompletedEvent(
        SOURCE_HASH_HEX,
        "MINT",
        true,
        "mint-ok",
        "0x4100000000000000000000000000000000000000000000000000000000000003",
        3,
        1700000180,
      ),
    );

    const batchId = SOURCE_HASH_HEX;
    assert.entityCount("VerificationBatch", 1);
    assert.entityCount("VerificationPhase", 3);
    assert.fieldEquals("VerificationBatch", batchId, "status", "VERIFIED");
    assert.fieldEquals("VerificationBatch", batchId, "currentPhase", "MINT");
    assert.fieldEquals("VerificationBatch", batchId, "sourceCheckPassed", "true");
    assert.fieldEquals("VerificationBatch", batchId, "logicCheckPassed", "true");
    assert.fieldEquals("VerificationBatch", batchId, "mintCheckPassed", "true");
    assert.fieldEquals("VerificationBatch", batchId, "passed", "true");

    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "verificationsSubmitted", "1");
    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "verificationsCompleted", "1");
    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "verificationsPassed", "1");
  });

  test("marks failed SOURCE phase as terminal and updates stats", () => {
    clearStore();

    handleVerificationPhaseCompleted(
      createVerificationPhaseCompletedEvent(
        FAILING_SOURCE_HASH_HEX,
        "SOURCE",
        false,
        "invalid-operator",
        "0x4200000000000000000000000000000000000000000000000000000000000001",
        1,
        1700000260,
      ),
    );

    assert.entityCount("VerificationBatch", 1);
    assert.entityCount("VerificationPhase", 1);

    assert.fieldEquals("VerificationBatch", FAILING_SOURCE_HASH_HEX, "status", "FAILED");
    assert.fieldEquals("VerificationBatch", FAILING_SOURCE_HASH_HEX, "passed", "false");
    assert.fieldEquals("VerificationBatch", FAILING_SOURCE_HASH_HEX, "sourceCheckPassed", "false");

    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "verificationsSubmitted", "1");
    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "verificationsCompleted", "1");
    assert.fieldEquals("DailyStats", DAY_BUCKET_ID, "verificationsPassed", "0");
  });

  afterAll(() => {
    clearStore();
  });
});
