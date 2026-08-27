import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * NativeIoTOracle v2.0.0 — Enterprise Test Suite
 *
 * Coverage targets:
 *   - 100% statement coverage
 *   - 100% branch coverage
 *   - Full access control path testing
 *   - Anomaly detection & auto-suspension
 *   - Batch submission
 *   - Data history & pagination
 *   - Configuration management
 *   - Upgrade authorization
 *   - Edge cases & boundary conditions
 */
describe("NativeIoTOracle", function () {
  let accessControl: any;
  let oracle: any;
  let admin: SignerWithAddress;
  let oracleNode: SignerWithAddress;
  let oracleAdmin: SignerWithAddress;
  let unauthorized: SignerWithAddress;
  let upgrader: SignerWithAddress;

  // Role hashes
  const ORACLE_NODE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_NODE_ROLE"));
  const ORACLE_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ADMIN_ROLE"));
  const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));

  // Test data constants
  const DAC_ID = "DAC-001";
  const DAC_ID_2 = "DAC-002";
  const CO2 = ethers.parseUnits("100", 18); // 100 grams at 1e18 precision
  const ENERGY = ethers.parseUnits("50", 18); // 50 watt-hours at 1e18 precision
  const SATELLITE_CID = "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
  const SATELLITE_CID_2 = "ipfs://QmThermalAnomalyDetectedByESACopernicus2026";

  beforeEach(async function () {
    [admin, oracleNode, oracleAdmin, unauthorized, upgrader] = await ethers.getSigners();

    // 1. Deploy AccessControl (requires admin address as initializer argument)
    const AccessControl = await ethers.getContractFactory("TerraQuraAccessControl");
    accessControl = await upgrades.deployProxy(AccessControl, [admin.address], { initializer: "initialize" });
    await accessControl.waitForDeployment();

    // 2. Deploy NativeIoTOracle via UUPS proxy
    const NativeIoTOracle = await ethers.getContractFactory("NativeIoTOracle");
    oracle = await upgrades.deployProxy(
      NativeIoTOracle,
      [await accessControl.getAddress()],
      { initializer: "initialize", kind: "uups" }
    );
    await oracle.waitForDeployment();

    // 3. Grant roles
    await accessControl.grantRole(ORACLE_NODE_ROLE, oracleNode.address);
    await accessControl.grantRole(ORACLE_ADMIN_ROLE, oracleAdmin.address);
    await accessControl.grantRole(UPGRADER_ROLE, upgrader.address);
  });

  // ============================================
  // INITIALIZATION
  // ============================================

  describe("Initialization", function () {
    it("should set the correct AccessControl address", async function () {
      expect(await oracle.accessControl()).to.equal(await accessControl.getAddress());
    });

    it("should set the correct version", async function () {
      expect(await oracle.VERSION()).to.equal("2.0.0");
    });

    it("should set default heartbeat timeout to 3600 seconds", async function () {
      expect(await oracle.heartbeatTimeout()).to.equal(3600);
    });

    it("should set default max history per device to 1000", async function () {
      expect(await oracle.maxHistoryPerDevice()).to.equal(1000);
    });

    it("should set default anomaly threshold to 5", async function () {
      expect(await oracle.anomalyThreshold()).to.equal(5);
    });

    it("should set default min submission interval to 0 (disabled)", async function () {
      expect(await oracle.minSubmissionInterval()).to.equal(0);
    });

    it("should start with zero total submissions", async function () {
      expect(await oracle.totalSubmissions()).to.equal(0);
    });

    it("should start with zero registered devices", async function () {
      expect(await oracle.getDeviceCount()).to.equal(0);
    });

    it("should revert initialization with zero address", async function () {
      const NativeIoTOracle = await ethers.getContractFactory("NativeIoTOracle");
      await expect(
        upgrades.deployProxy(
          NativeIoTOracle,
          [ethers.ZeroAddress],
          { initializer: "initialize", kind: "uups" }
        )
      ).to.be.revertedWithCustomError(oracle, "InvalidConfigValue");
    });

    it("should not allow re-initialization", async function () {
      await expect(
        oracle.initialize(await accessControl.getAddress())
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  // ============================================
  // ACCESS CONTROL
  // ============================================

  describe("Access Control", function () {
    it("should revert pushSensorData from unauthorized caller", async function () {
      await expect(
        oracle.connect(unauthorized).pushSensorData(DAC_ID, CO2, ENERGY, false, SATELLITE_CID)
      ).to.be.revertedWithCustomError(oracle, "UnauthorizedOracleNode");
    });

    it("should revert pushBatchSensorData from unauthorized caller", async function () {
      await expect(
        oracle.connect(unauthorized).pushBatchSensorData(
          [DAC_ID], [CO2], [ENERGY], [false], [SATELLITE_CID]
        )
      ).to.be.revertedWithCustomError(oracle, "UnauthorizedOracleNode");
    });

    it("should revert admin functions from non-admin", async function () {
      await expect(
        oracle.connect(unauthorized).setHeartbeatTimeout(7200)
      ).to.be.revertedWithCustomError(oracle, "UnauthorizedAdmin");

      await expect(
        oracle.connect(unauthorized).setMaxHistoryPerDevice(500)
      ).to.be.revertedWithCustomError(oracle, "UnauthorizedAdmin");

      await expect(
        oracle.connect(unauthorized).setMinSubmissionInterval(60)
      ).to.be.revertedWithCustomError(oracle, "UnauthorizedAdmin");

      await expect(
        oracle.connect(unauthorized).setAnomalyThreshold(10)
      ).to.be.revertedWithCustomError(oracle, "UnauthorizedAdmin");
    });

    it("should allow ORACLE_ADMIN_ROLE to call admin functions", async function () {
      await expect(oracle.connect(oracleAdmin).setHeartbeatTimeout(7200)).to.not.be.reverted;
    });

    it("should allow DEFAULT_ADMIN_ROLE to call admin functions", async function () {
      await expect(oracle.connect(admin).setHeartbeatTimeout(7200)).to.not.be.reverted;
    });
  });

  // ============================================
  // SINGLE DATA SUBMISSION
  // ============================================

  describe("Single Data Submission", function () {
    it("should push valid data and emit IoTDataLogged", async function () {
      const tx = await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      // For indexed string parameters, we just verify the event was emitted
      // (Solidity hashes indexed strings, so direct matching isn't possible)
      await expect(tx).to.emit(oracle, "IoTDataLogged");
    });

    it("should correctly store latest data", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      const data = await oracle.getLatestData(DAC_ID);
      expect(data.co2Captured).to.equal(CO2);
      expect(data.energyUsed).to.equal(ENERGY);
      expect(data.anomalyFlag).to.be.false;
      expect(data.satelliteCID).to.equal(SATELLITE_CID);
      expect(data.timestamp).to.be.gt(0);
    });

    it("should increment total submissions", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );
      expect(await oracle.totalSubmissions()).to.equal(1);

      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID_2, CO2, ENERGY, false, SATELLITE_CID
      );
      expect(await oracle.totalSubmissions()).to.equal(2);
    });

    it("should register device on first submission", async function () {
      const tx = await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      await expect(tx).to.emit(oracle, "DeviceRegistered");

      expect(await oracle.getDeviceCount()).to.equal(1);
      const devices = await oracle.getRegisteredDevices();
      expect(devices[0]).to.equal(DAC_ID);
    });

    it("should not re-register device on subsequent submissions", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      const tx = await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2 * 2n, ENERGY * 2n, false, SATELLITE_CID_2
      );

      // Should NOT emit DeviceRegistered again
      await expect(tx).to.not.emit(oracle, "DeviceRegistered");
      expect(await oracle.getDeviceCount()).to.equal(1);
    });

    it("should update latest data on subsequent submissions", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      const newCO2 = CO2 * 2n;
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, newCO2, ENERGY, false, SATELLITE_CID_2
      );

      const data = await oracle.getLatestData(DAC_ID);
      expect(data.co2Captured).to.equal(newCO2);
      expect(data.satelliteCID).to.equal(SATELLITE_CID_2);
    });

    it("should revert on empty device ID", async function () {
      await expect(
        oracle.connect(oracleNode).pushSensorData("", CO2, ENERGY, false, SATELLITE_CID)
      ).to.be.revertedWithCustomError(oracle, "EmptyDeviceId");
    });

    it("should accept zero CO2 and zero energy values", async function () {
      // Edge case: device sends zero readings (e.g., startup/calibration)
      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, 0, 0, false, "")
      ).to.not.be.reverted;

      const data = await oracle.getLatestData(DAC_ID);
      expect(data.co2Captured).to.equal(0);
      expect(data.energyUsed).to.equal(0);
      expect(data.satelliteCID).to.equal("");
    });
  });

  // ============================================
  // ANOMALY DETECTION
  // ============================================

  describe("Anomaly Detection", function () {
    it("should emit AnomalyDetected when anomaly flag is true", async function () {
      const tx = await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, 9999n, 1n, true, SATELLITE_CID_2
      );

      await expect(tx).to.emit(oracle, "AnomalyDetected");
    });

    it("should increment anomaly count on flagged submissions", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, true, SATELLITE_CID
      );
      expect(await oracle.anomalyCount(DAC_ID)).to.equal(1);

      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, true, SATELLITE_CID
      );
      expect(await oracle.anomalyCount(DAC_ID)).to.equal(2);
    });

    it("should reset anomaly count on clean reading", async function () {
      // Submit 3 anomalies
      for (let i = 0; i < 3; i++) {
        await oracle.connect(oracleNode).pushSensorData(
          DAC_ID, CO2, ENERGY, true, SATELLITE_CID
        );
      }
      expect(await oracle.anomalyCount(DAC_ID)).to.equal(3);

      // Submit clean reading
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );
      expect(await oracle.anomalyCount(DAC_ID)).to.equal(0);
    });

    it("should auto-suspend device after reaching anomaly threshold", async function () {
      // Default threshold is 5
      for (let i = 0; i < 4; i++) {
        await oracle.connect(oracleNode).pushSensorData(
          DAC_ID, CO2, ENERGY, true, SATELLITE_CID
        );
      }
      expect(await oracle.suspendedDevices(DAC_ID)).to.be.false;

      // 5th anomaly triggers suspension
      const tx = await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, true, SATELLITE_CID
      );

      await expect(tx).to.emit(oracle, "DeviceSuspended");
      expect(await oracle.suspendedDevices(DAC_ID)).to.be.true;
    });

    it("should revert submissions for suspended devices", async function () {
      // Suspend device
      for (let i = 0; i < 5; i++) {
        await oracle.connect(oracleNode).pushSensorData(
          DAC_ID, CO2, ENERGY, true, SATELLITE_CID
        );
      }

      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, CO2, ENERGY, false, SATELLITE_CID)
      ).to.be.revertedWithCustomError(oracle, "DeviceSuspendedError");
    });

    it("should allow admin to reinstate suspended device", async function () {
      // Suspend device
      for (let i = 0; i < 5; i++) {
        await oracle.connect(oracleNode).pushSensorData(
          DAC_ID, CO2, ENERGY, true, SATELLITE_CID
        );
      }

      const tx = await oracle.connect(oracleAdmin).reinstateDevice(DAC_ID);
      await expect(tx).to.emit(oracle, "DeviceReinstated");

      expect(await oracle.suspendedDevices(DAC_ID)).to.be.false;
      expect(await oracle.anomalyCount(DAC_ID)).to.equal(0);

      // Should accept new data after reinstatement
      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, CO2, ENERGY, false, SATELLITE_CID)
      ).to.not.be.reverted;
    });

    it("should revert reinstate for non-suspended device", async function () {
      await expect(
        oracle.connect(oracleAdmin).reinstateDevice(DAC_ID)
      ).to.be.revertedWithCustomError(oracle, "DeviceNotFound");
    });

    it("should not reset anomaly count if already zero on clean reading", async function () {
      // Submit clean reading when count is already 0
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );
      expect(await oracle.anomalyCount(DAC_ID)).to.equal(0);
    });
  });

  // ============================================
  // BATCH SUBMISSION
  // ============================================

  describe("Batch Submission", function () {
    it("should submit batch data for multiple devices", async function () {
      const dacIds = ["DAC-001", "DAC-002", "DAC-003"];
      const co2Values = [CO2, CO2 * 2n, CO2 * 3n];
      const energyValues = [ENERGY, ENERGY * 2n, ENERGY * 3n];
      const flags = [false, false, false];
      const cids = [SATELLITE_CID, SATELLITE_CID_2, SATELLITE_CID];

      const tx = await oracle.connect(oracleNode).pushBatchSensorData(
        dacIds, co2Values, energyValues, flags, cids
      );

      await expect(tx).to.emit(oracle, "BatchDataLogged").withArgs(3, await getBlockTimestamp(tx), oracleNode.address);

      // Verify each device
      const data1 = await oracle.getLatestData("DAC-001");
      expect(data1.co2Captured).to.equal(CO2);

      const data2 = await oracle.getLatestData("DAC-002");
      expect(data2.co2Captured).to.equal(CO2 * 2n);

      const data3 = await oracle.getLatestData("DAC-003");
      expect(data3.co2Captured).to.equal(CO2 * 3n);

      // All devices registered
      expect(await oracle.getDeviceCount()).to.equal(3);
      expect(await oracle.totalSubmissions()).to.equal(3);
    });

    it("should revert on empty batch", async function () {
      await expect(
        oracle.connect(oracleNode).pushBatchSensorData([], [], [], [], [])
      ).to.be.revertedWithCustomError(oracle, "BatchTooLarge");
    });

    it("should revert on batch exceeding MAX_BATCH_SIZE", async function () {
      const size = 51;
      const dacIds = Array.from({ length: size }, (_, i) => `DAC-${i}`);
      const co2Values = Array(size).fill(CO2);
      const energyValues = Array(size).fill(ENERGY);
      const flags = Array(size).fill(false);
      const cids = Array(size).fill(SATELLITE_CID);

      await expect(
        oracle.connect(oracleNode).pushBatchSensorData(
          dacIds, co2Values, energyValues, flags, cids
        )
      ).to.be.revertedWithCustomError(oracle, "BatchTooLarge");
    });

    it("should revert on mismatched array lengths", async function () {
      await expect(
        oracle.connect(oracleNode).pushBatchSensorData(
          ["DAC-001", "DAC-002"],
          [CO2],
          [ENERGY, ENERGY],
          [false, false],
          [SATELLITE_CID, SATELLITE_CID]
        )
      ).to.be.revertedWithCustomError(oracle, "BatchLengthMismatch");
    });
  });

  // ============================================
  // DATA HISTORY & PAGINATION
  // ============================================

  describe("Data History", function () {
    beforeEach(async function () {
      // Submit 5 readings for DAC_ID
      for (let i = 1; i <= 5; i++) {
        await oracle.connect(oracleNode).pushSensorData(
          DAC_ID,
          ethers.parseUnits(String(i * 10), 18),
          ethers.parseUnits(String(i * 5), 18),
          false,
          `ipfs://QmReading${i}`
        );
      }
    });

    it("should track history count", async function () {
      expect(await oracle.getHistoryCount(DAC_ID)).to.equal(5);
    });

    it("should return full history with pagination", async function () {
      const [entries, total] = await oracle.getDataHistory(DAC_ID, 0, 5);
      expect(total).to.equal(5);
      expect(entries.length).to.equal(5);
      expect(entries[0].co2Captured).to.equal(ethers.parseUnits("10", 18));
      expect(entries[4].co2Captured).to.equal(ethers.parseUnits("50", 18));
    });

    it("should support offset-based pagination", async function () {
      const [entries, total] = await oracle.getDataHistory(DAC_ID, 2, 2);
      expect(total).to.equal(5);
      expect(entries.length).to.equal(2);
      expect(entries[0].co2Captured).to.equal(ethers.parseUnits("30", 18));
      expect(entries[1].co2Captured).to.equal(ethers.parseUnits("40", 18));
    });

    it("should return empty array for offset beyond history", async function () {
      const [entries, total] = await oracle.getDataHistory(DAC_ID, 100, 10);
      expect(total).to.equal(5);
      expect(entries.length).to.equal(0);
    });

    it("should return empty array for zero limit", async function () {
      const [entries, total] = await oracle.getDataHistory(DAC_ID, 0, 0);
      expect(total).to.equal(5);
      expect(entries.length).to.equal(0);
    });

    it("should clamp limit to available entries", async function () {
      const [entries, total] = await oracle.getDataHistory(DAC_ID, 3, 100);
      expect(total).to.equal(5);
      expect(entries.length).to.equal(2); // Only 2 entries left from offset 3
    });

    it("should return empty for unregistered device", async function () {
      const [entries, total] = await oracle.getDataHistory("NONEXISTENT", 0, 10);
      expect(total).to.equal(0);
      expect(entries.length).to.equal(0);
    });

    it("should cap retained history and keep the most recent readings", async function () {
      await oracle.connect(oracleAdmin).setMaxHistoryPerDevice(3);

      for (let i = 6; i <= 8; i++) {
        await oracle.connect(oracleNode).pushSensorData(
          DAC_ID,
          ethers.parseUnits(String(i * 10), 18),
          ethers.parseUnits(String(i * 5), 18),
          false,
          `ipfs://QmReading${i}`
        );
      }

      const [entries, total] = await oracle.getDataHistory(DAC_ID, 0, 10);
      expect(total).to.equal(3);
      expect(entries.length).to.equal(3);
      expect(entries[0].co2Captured).to.equal(ethers.parseUnits("60", 18));
      expect(entries[1].co2Captured).to.equal(ethers.parseUnits("70", 18));
      expect(entries[2].co2Captured).to.equal(ethers.parseUnits("80", 18));
    });
  });

  // ============================================
  // DATA FRESHNESS (HEARTBEAT)
  // ============================================

  describe("Data Freshness", function () {
    it("should report fresh data immediately after submission", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      const [isFresh, lastTimestamp, age] = await oracle.isDataFresh(DAC_ID);
      expect(isFresh).to.be.true;
      expect(lastTimestamp).to.be.gt(0);
      expect(age).to.be.lte(2); // Within a few seconds
    });

    it("should report stale data for devices with no submissions", async function () {
      const [isFresh, lastTimestamp, age] = await oracle.isDataFresh("NONEXISTENT");
      expect(isFresh).to.be.false;
      expect(lastTimestamp).to.equal(0);
      expect(age).to.equal(ethers.MaxUint256);
    });

    it("should report stale data after heartbeat timeout", async function () {
      // Set short heartbeat for testing
      await oracle.connect(oracleAdmin).setHeartbeatTimeout(60);

      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      // Advance time past heartbeat
      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);

      const [isFresh, , age] = await oracle.isDataFresh(DAC_ID);
      expect(isFresh).to.be.false;
      expect(age).to.be.gte(120);
    });
  });

  // ============================================
  // RATE LIMITING
  // ============================================

  describe("Rate Limiting", function () {
    beforeEach(async function () {
      // Enable rate limiting: 60 second minimum interval
      await oracle.connect(oracleAdmin).setMinSubmissionInterval(60);
    });

    it("should allow first submission regardless of interval", async function () {
      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, CO2, ENERGY, false, SATELLITE_CID)
      ).to.not.be.reverted;
    });

    it("should revert submission within interval", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, CO2, ENERGY, false, SATELLITE_CID)
      ).to.be.revertedWithCustomError(oracle, "SubmissionTooFrequent");
    });

    it("should allow submission after interval has elapsed", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      // Advance time past interval
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, CO2, ENERGY, false, SATELLITE_CID)
      ).to.not.be.reverted;
    });

    it("should apply rate limiting per device independently", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      // Different device should work immediately
      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID_2, CO2, ENERGY, false, SATELLITE_CID)
      ).to.not.be.reverted;
    });
  });

  // ============================================
  // CONFIGURATION MANAGEMENT
  // ============================================

  describe("Configuration", function () {
    describe("setHeartbeatTimeout", function () {
      it("should update heartbeat timeout", async function () {
        const tx = await oracle.connect(oracleAdmin).setHeartbeatTimeout(7200);
        await expect(tx).to.emit(oracle, "ConfigUpdated");
        expect(await oracle.heartbeatTimeout()).to.equal(7200);
      });

      it("should revert on timeout below minimum (60s)", async function () {
        await expect(
          oracle.connect(oracleAdmin).setHeartbeatTimeout(30)
        ).to.be.revertedWithCustomError(oracle, "InvalidConfigValue");
      });

      it("should revert on timeout above maximum (86400s)", async function () {
        await expect(
          oracle.connect(oracleAdmin).setHeartbeatTimeout(90000)
        ).to.be.revertedWithCustomError(oracle, "InvalidConfigValue");
      });

      it("should accept boundary values", async function () {
        await expect(oracle.connect(oracleAdmin).setHeartbeatTimeout(60)).to.not.be.reverted;
        await expect(oracle.connect(oracleAdmin).setHeartbeatTimeout(86400)).to.not.be.reverted;
      });
    });

    describe("setMaxHistoryPerDevice", function () {
      it("should update max history", async function () {
        await oracle.connect(oracleAdmin).setMaxHistoryPerDevice(500);
        expect(await oracle.maxHistoryPerDevice()).to.equal(500);
      });

      it("should accept zero (unlimited)", async function () {
        await oracle.connect(oracleAdmin).setMaxHistoryPerDevice(0);
        expect(await oracle.maxHistoryPerDevice()).to.equal(0);
      });

      it("should revert above maximum (10000)", async function () {
        await expect(
          oracle.connect(oracleAdmin).setMaxHistoryPerDevice(10001)
        ).to.be.revertedWithCustomError(oracle, "InvalidConfigValue");
      });
    });

    describe("setMinSubmissionInterval", function () {
      it("should update interval", async function () {
        await oracle.connect(oracleAdmin).setMinSubmissionInterval(120);
        expect(await oracle.minSubmissionInterval()).to.equal(120);
      });

      it("should accept zero (disabled)", async function () {
        await oracle.connect(oracleAdmin).setMinSubmissionInterval(0);
        expect(await oracle.minSubmissionInterval()).to.equal(0);
      });

      it("should revert above maximum (3600s)", async function () {
        await expect(
          oracle.connect(oracleAdmin).setMinSubmissionInterval(3601)
        ).to.be.revertedWithCustomError(oracle, "InvalidConfigValue");
      });
    });

    describe("setAnomalyThreshold", function () {
      it("should update threshold", async function () {
        await oracle.connect(oracleAdmin).setAnomalyThreshold(10);
        expect(await oracle.anomalyThreshold()).to.equal(10);
      });

      it("should revert on zero", async function () {
        await expect(
          oracle.connect(oracleAdmin).setAnomalyThreshold(0)
        ).to.be.revertedWithCustomError(oracle, "InvalidConfigValue");
      });

      it("should revert above maximum (100)", async function () {
        await expect(
          oracle.connect(oracleAdmin).setAnomalyThreshold(101)
        ).to.be.revertedWithCustomError(oracle, "InvalidConfigValue");
      });
    });
  });

  // ============================================
  // PAUSE INTEGRATION
  // ============================================

  describe("Pause Integration", function () {
    it("should revert pushSensorData when system is paused", async function () {
      // emergencyPause requires PAUSER_ROLE and a reason string
      await accessControl.connect(admin).emergencyPause("Oracle test pause");

      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, CO2, ENERGY, false, SATELLITE_CID)
      ).to.be.revertedWithCustomError(oracle, "SystemPaused");
    });

    it("should revert batch submission when system is paused", async function () {
      await accessControl.connect(admin).emergencyPause("Batch test pause");

      await expect(
        oracle.connect(oracleNode).pushBatchSensorData(
          [DAC_ID], [CO2], [ENERGY], [false], [SATELLITE_CID]
        )
      ).to.be.revertedWithCustomError(oracle, "SystemPaused");
    });

    it("should allow submissions after unpause", async function () {
      await accessControl.connect(admin).emergencyPause("Temporary pause");
      // unpause() requires ADMIN_ROLE (admin already has it)
      await accessControl.connect(admin).unpause();

      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, CO2, ENERGY, false, SATELLITE_CID)
      ).to.not.be.reverted;
    });

    it("should still allow reads when paused", async function () {
      await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );

      await accessControl.connect(admin).emergencyPause("Read-while-paused test");

      // Read operations should still work
      const data = await oracle.getLatestData(DAC_ID);
      expect(data.co2Captured).to.equal(CO2);

      const [isFresh] = await oracle.isDataFresh(DAC_ID);
      expect(isFresh).to.be.true;
    });
  });

  // ============================================
  // UPGRADE AUTHORIZATION
  // ============================================

  describe("Upgrade Authorization", function () {
    it("should allow UPGRADER_ROLE to upgrade", async function () {
      const NativeIoTOracleV2 = await ethers.getContractFactory("NativeIoTOracle");

      // This should not revert (upgrader has UPGRADER_ROLE)
      await expect(
        upgrades.upgradeProxy(await oracle.getAddress(), NativeIoTOracleV2.connect(upgrader), {
          kind: "uups",
        })
      ).to.not.be.reverted;
    });

    it("should allow DEFAULT_ADMIN_ROLE to upgrade", async function () {
      const NativeIoTOracleV2 = await ethers.getContractFactory("NativeIoTOracle");

      await expect(
        upgrades.upgradeProxy(await oracle.getAddress(), NativeIoTOracleV2.connect(admin), {
          kind: "uups",
        })
      ).to.not.be.reverted;
    });

    it("should revert upgrade from unauthorized address", async function () {
      const NativeIoTOracleV2 = await ethers.getContractFactory("NativeIoTOracle");

      await expect(
        upgrades.upgradeProxy(await oracle.getAddress(), NativeIoTOracleV2.connect(unauthorized), {
          kind: "uups",
        })
      ).to.be.reverted;
    });
  });

  // ============================================
  // EDGE CASES & BOUNDARY CONDITIONS
  // ============================================

  describe("Edge Cases", function () {
    it("should handle maximum uint256 CO2 values", async function () {
      const maxCO2 = ethers.MaxUint256;
      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, maxCO2, ENERGY, false, SATELLITE_CID)
      ).to.not.be.reverted;

      const data = await oracle.getLatestData(DAC_ID);
      expect(data.co2Captured).to.equal(maxCO2);
    });

    it("should handle empty satellite CID", async function () {
      await oracle.connect(oracleNode).pushSensorData(DAC_ID, CO2, ENERGY, false, "");

      const data = await oracle.getLatestData(DAC_ID);
      expect(data.satelliteCID).to.equal("");
    });

    it("should handle very long satellite CID", async function () {
      const longCID = "ipfs://" + "a".repeat(256);
      await expect(
        oracle.connect(oracleNode).pushSensorData(DAC_ID, CO2, ENERGY, false, longCID)
      ).to.not.be.reverted;

      const data = await oracle.getLatestData(DAC_ID);
      expect(data.satelliteCID).to.equal(longCID);
    });

    it("should handle special characters in device ID", async function () {
      const specialId = "DAC-ABU-DHABI-001/Sector-A";
      await expect(
        oracle.connect(oracleNode).pushSensorData(specialId, CO2, ENERGY, false, SATELLITE_CID)
      ).to.not.be.reverted;

      const data = await oracle.getLatestData(specialId);
      expect(data.co2Captured).to.equal(CO2);
    });

    it("should return default values for unregistered device", async function () {
      const data = await oracle.getLatestData("NONEXISTENT");
      expect(data.co2Captured).to.equal(0);
      expect(data.energyUsed).to.equal(0);
      expect(data.timestamp).to.equal(0);
      expect(data.anomalyFlag).to.be.false;
      expect(data.satelliteCID).to.equal("");
    });

    it("should handle rapid sequential submissions from multiple devices", async function () {
      // Submit data for 10 different devices in sequence
      for (let i = 0; i < 10; i++) {
        await oracle.connect(oracleNode).pushSensorData(
          `DAC-${String(i).padStart(3, "0")}`,
          CO2 * BigInt(i + 1),
          ENERGY * BigInt(i + 1),
          false,
          `ipfs://QmDevice${i}`
        );
      }

      expect(await oracle.getDeviceCount()).to.equal(10);
      expect(await oracle.totalSubmissions()).to.equal(10);
    });

    it("should handle batch with one suspended device gracefully", async function () {
      // Suspend DAC-001
      for (let i = 0; i < 5; i++) {
        await oracle.connect(oracleNode).pushSensorData(
          DAC_ID, CO2, ENERGY, true, SATELLITE_CID
        );
      }

      // Batch including suspended device should revert
      await expect(
        oracle.connect(oracleNode).pushBatchSensorData(
          [DAC_ID, DAC_ID_2],
          [CO2, CO2],
          [ENERGY, ENERGY],
          [false, false],
          [SATELLITE_CID, SATELLITE_CID]
        )
      ).to.be.revertedWithCustomError(oracle, "DeviceSuspendedError");
    });
  });

  // ============================================
  // GAS BENCHMARKS
  // ============================================

  describe("Gas Benchmarks", function () {
    it("single pushSensorData gas cost", async function () {
      const tx = await oracle.connect(oracleNode).pushSensorData(
        DAC_ID, CO2, ENERGY, false, SATELLITE_CID
      );
      const receipt = await tx.wait();
      console.log(`    Single push gas: ${receipt!.gasUsed.toString()}`);
    });

    it("batch pushSensorData gas cost (10 devices)", async function () {
      const count = 10;
      const dacIds = Array.from({ length: count }, (_, i) => `DAC-${String(i).padStart(3, "0")}`);
      const co2Values = Array(count).fill(CO2);
      const energyValues = Array(count).fill(ENERGY);
      const flags = Array(count).fill(false);
      const cids = Array(count).fill(SATELLITE_CID);

      const tx = await oracle.connect(oracleNode).pushBatchSensorData(
        dacIds, co2Values, energyValues, flags, cids
      );
      const receipt = await tx.wait();
      console.log(`    Batch (10) gas: ${receipt!.gasUsed.toString()}`);
      console.log(`    Per-device in batch: ${(Number(receipt!.gasUsed) / count).toFixed(0)}`);
    });
  });

  // ============================================
  // HELPERS
  // ============================================

  async function getBlockTimestamp(tx: any): Promise<number> {
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    return block!.timestamp;
  }
});
