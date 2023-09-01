import { expect, assert } from "chai";
import { ethers, network } from "hardhat";
import {
  TestTimeLock,
  TestTimeLock__factory,
  TimeLock,
  TimeLock__factory,
} from "../../typechain-types";

// Function
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Data
import {
  ADDRESS_ZERO,
  FUNC,
  GRACE_PERIOD,
  MAX_DELAY,
  MIN_DELAY,
  developmentChains,
} from "../../helper-hardhat-config";

// Types
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractTransaction, ContractReceipt } from "ethers/src.ts/ethers";
import { BigNumber } from "ethers";

// ------------

describe("TimeLock", function () {
  beforeEach(async () => {
    if (!developmentChains.includes(network.name)) {
      throw new Error("You need to be on a development chain to run unit tests");
    }
  });

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  type DeployFixture = {
    deployer: SignerWithAddress;
    timeLock: TimeLock;
    testTimeLock: TestTimeLock;
  };
  async function deployTimeLockFixture(): Promise<DeployFixture> {
    const [deployer]: SignerWithAddress[] = await ethers.getSigners();

    // Deploy `TimeLock` Contract
    const timeLockFactory: TimeLock__factory = await ethers.getContractFactory(
      "TimeLock",
      deployer
    );
    const timeLock: TimeLock = await timeLockFactory.deploy();
    await timeLock.deployed();

    // Deploy `TestTimeLock` Contract
    const testTimeLockFactory: TestTimeLock__factory = await ethers.getContractFactory(
      "TestTimeLock",
      deployer
    );
    const testTimeLock: TestTimeLock = await testTimeLockFactory.deploy();
    await testTimeLock.deployed();

    return { deployer, timeLock, testTimeLock };
  }

  async function getBlockTimestamp(): Promise<number> {
    const blockNumber: number = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);

    // Extract the timestamp from the block data
    const blockTimestamp: number = block.timestamp;
    return blockTimestamp;
  }

  async function queueTx(timeLock: TimeLock, testTimeLock: TestTimeLock) {
    const blockTimestamp: number = await getBlockTimestamp();
    const timestampParam: number = blockTimestamp + MIN_DELAY + 1;

    const encodedData = testTimeLock.interface.encodeFunctionData("getName");

    const txId: string = await timeLock.getTxId(
      testTimeLock.address,
      0,
      encodedData,
      timestampParam
    );

    await timeLock.queue(testTimeLock.address, 0, encodedData, timestampParam);

    return txId;
  }
  async function increaseTime(amount: number) {
    await ethers.provider.send("evm_increaseTime", [amount]);
    await ethers.provider.send("evm_mine", []);
  }

  // Encode function call from `TestTimeLock` contract
  type testTimeLockFunction = "getName" | "setName";
  function encodedFunction(testTimeLock: TestTimeLock, func: testTimeLockFunction) {
    let encodedData = "";
    switch (func) {
      case "getName":
        // const functionSignature = testTimeLock.interface.getFunction(func).format();
        encodedData = testTimeLock.interface.encodeFunctionData(func);
        break;

      case "setName":
        const newValue = "Ahmed";
        encodedData = testTimeLock.interface.encodeFunctionData(func, [newValue]);
        break;
    }
    return encodedData;
  }

  describe("#queue", function () {
    it("should emit `Queue` on successful queueing the transaction", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);

      const blockTimestamp: number = await getBlockTimestamp();
      const timestampParam: number = blockTimestamp + MIN_DELAY + 1;

      const txId: string = await timeLock.getTxId(
        testTimeLock.address,
        0,
        encodedFunction(testTimeLock, "getName"),
        timestampParam
      );

      await expect(
        timeLock.queue(
          testTimeLock.address,
          0,
          encodedFunction(testTimeLock, "getName"),
          timestampParam
        )
      )
        .to.emit(timeLock, "Queue")
        .withArgs(
          txId,
          testTimeLock.address,
          0,
          encodedFunction(testTimeLock, "getName"),
          timestampParam
        );
    });

    it("should update tx params values to the values sent", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const blockTimestamp: number = await getBlockTimestamp();
      const timestampParam: number = blockTimestamp + MIN_DELAY + 1;

      const txId: string = await timeLock.getTxId(
        testTimeLock.address,
        0,
        encodedFunction(testTimeLock, "getName"),
        timestampParam
      );

      await timeLock.queue(
        testTimeLock.address,
        0,
        encodedFunction(testTimeLock, "getName"),
        timestampParam
      );

      const transaction = await timeLock.getTxInfo(txId);

      assert.equal(transaction.target, testTimeLock.address);
      assert.equal(transaction.value.toString(), "0");
      assert.equal(transaction.data, encodedFunction(testTimeLock, "getName"));
      assert.equal(transaction.timestamp.toString(), timestampParam.toString());
      assert.equal(transaction.status, 1 /* IN_QUEUE */);
    });

    it("should add the tx in the queue if this transaction was in `EXPIRED` state", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const blockTimestamp: number = await getBlockTimestamp();
      // We are increasing the time by one hour so if the user submit a tx and then canceled it he can resubmit it successfully
      const timestampParam: number = blockTimestamp + MIN_DELAY + 3600;

      const txId: string = await timeLock.getTxId(
        testTimeLock.address,
        0,
        encodedFunction(testTimeLock, "getName"),
        timestampParam
      );

      await timeLock.queue(
        testTimeLock.address,
        0,
        encodedFunction(testTimeLock, "getName"),
        timestampParam
      );

      await timeLock.cancel(txId);

      await expect(
        timeLock.queue(
          testTimeLock.address,
          0,
          encodedFunction(testTimeLock, "getName"),
          timestampParam
        )
      )
        .to.emit(timeLock, "Queue")
        .withArgs(
          txId,
          testTimeLock.address,
          0,
          encodedFunction(testTimeLock, "getName"),
          timestampParam
        );
    });

    it("reverts if not the owner is trying to queue a transaction", async function () {
      const [, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);

      const blockTimestamp: number = await getBlockTimestamp();
      const timestampParam: number = blockTimestamp + MIN_DELAY + 1;

      await expect(
        timeLock
          .connect(hacker)
          .queue(testTimeLock.address, 0, encodedFunction(testTimeLock, "getName"), timestampParam)
      ).to.be.revertedWith(/Ownable: caller is not the owner/);
    });

    it("reverts if the transaction is in `IN_QUEUE` status", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const blockTimestamp: number = await getBlockTimestamp();
      const timestampParam: number = blockTimestamp + MIN_DELAY + 1;

      const txId: string = await timeLock.getTxId(
        testTimeLock.address,
        0,
        encodedFunction(testTimeLock, "getName"),
        timestampParam
      );

      await timeLock.queue(
        testTimeLock.address,
        0,
        encodedFunction(testTimeLock, "getName"),
        timestampParam
      );

      await expect(
        timeLock.queue(
          testTimeLock.address,
          0,
          encodedFunction(testTimeLock, "getName"),
          timestampParam
        )
      )
        .to.be.revertedWithCustomError(timeLock, "TimeLock__AlreadyQueued")
        .withArgs(txId);
    });

    it("reverts if the timestamp is less that `MIN_DELAY` ", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const blockTimestamp: number = await getBlockTimestamp();
      const invalidTimestampParam: number = blockTimestamp + MIN_DELAY - 1;

      await expect(
        timeLock.queue(
          testTimeLock.address,
          0,
          encodedFunction(testTimeLock, "getName"),
          invalidTimestampParam
        )
      )
        .to.be.revertedWithCustomError(timeLock, "TimeLock__TimestampNotInRange")
        .withArgs(blockTimestamp + 1, invalidTimestampParam);
    });

    it("reverts if the timestamp is greater that `MAX_DELAY` ", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const blockTimestamp: number = await getBlockTimestamp();
      const invalidTimestampParam: number = blockTimestamp + MAX_DELAY + 10;

      await expect(
        timeLock.queue(
          testTimeLock.address,
          0,
          encodedFunction(testTimeLock, "getName"),
          invalidTimestampParam
        )
      )
        .to.be.revertedWithCustomError(timeLock, "TimeLock__TimestampNotInRange")
        .withArgs(blockTimestamp + 1, invalidTimestampParam);
    });
  });

  describe("#execute", function () {
    it("should emit `Execute` event on successful executing", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const txId: string = await queueTx(timeLock, testTimeLock);

      // increasing time by 1 day + 1 hour to by in executing interval
      await increaseTime(24 * 60 * 60 + 3600);

      const transaction = await timeLock.getTxInfo(txId);

      await expect(timeLock.execute(txId))
        .to.emit(timeLock, "Execute")
        .withArgs(
          txId,
          transaction.target,
          transaction.value,
          transaction.data,
          transaction.timestamp
        );
    });

    it("should update transaction status into `EXPIRED`", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const txId: string = await queueTx(timeLock, testTimeLock);

      // increasing time by 1 day + 1 hour to by in executing interval
      await increaseTime(24 * 60 * 60 + 3600);

      await timeLock.execute(txId);

      const transaction = await timeLock.getTxInfo(txId);

      assert.equal(transaction.status, 2 /* EXPIRED */);
    });

    it("should  fire the function that is encoded to it (non-payable function, no parameters)", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);

      const txId: string = await queueTx(timeLock, testTimeLock);
      // increasing time by 1 day + 1 hour to by in executing interval
      await increaseTime(24 * 60 * 60 + 3600);

      await timeLock.execute(txId);

      // NOTE: we made console.log() in the `TestTimeLock` contract so we checked fo this test
    });

    it("should  fire the function that is encoded to it (non-payable function, with parameters)", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);

      const blockTimestamp: number = await getBlockTimestamp();
      const timestampParam: number = blockTimestamp + MIN_DELAY + 1;

      const testTimeLockNewName: string = "new Name";

      const encodedData = testTimeLock.interface.encodeFunctionData("setName", [
        testTimeLockNewName,
      ]);

      const txId: string = await timeLock.getTxId(
        testTimeLock.address,
        0,
        encodedData,
        timestampParam
      );

      await timeLock.queue(testTimeLock.address, 0, encodedData, timestampParam);

      // increasing time by 1 day + 1 hour to by in executing interval

      await increaseTime(24 * 60 * 60 + 3600);

      await timeLock.execute(txId);

      const newName: string = await testTimeLock.getName();

      assert.equal(testTimeLockNewName, newName);
    });

    it("should reverts if the function that is encoded is not correct", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);

      const blockTimestamp: number = await getBlockTimestamp();
      const timestampParam: number = blockTimestamp + MIN_DELAY + 1;

      const invalidEncodedData = "0xab1236";

      console.log(invalidEncodedData);

      const txId: string = await timeLock.getTxId(
        testTimeLock.address,
        0,
        invalidEncodedData,
        timestampParam
      );

      await timeLock.queue(testTimeLock.address, 0, invalidEncodedData, timestampParam);

      // increasing time by 1 day + 1 hour to by in executing interval

      await increaseTime(24 * 60 * 60 + 3600);

      await expect(timeLock.execute(txId)).to.be.revertedWithCustomError(
        timeLock,
        "TimeLock__TransactionFailed"
      );
    });

    it("reverts if not the owner is executing the transaction", async function () {
      const [, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const txId: string = await queueTx(timeLock, testTimeLock);

      // increasing time by 1 day + 1 hour to by in executing interval
      await increaseTime(24 * 60 * 60 + 3600);

      await expect(timeLock.connect(hacker).execute(txId)).to.be.revertedWith(
        /Ownable: caller is not the owner/
      );
    });

    it("reverts if transaction is not in queue", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const txId: string = await queueTx(timeLock, testTimeLock);

      // increasing time by 1 day + 1 hour to by in executing interval
      await increaseTime(24 * 60 * 60 + 3600);

      await timeLock.execute(txId);

      await expect(timeLock.execute(txId))
        .to.be.revertedWithCustomError(timeLock, "TimeLock__TxNotQueued")
        .withArgs(txId);
    });

    it("reverts if the time to execute hasn't reached yet", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const txId: string = await queueTx(timeLock, testTimeLock);

      // increasing time by 1 day - 1 hour to check executing when timestamp is on the future
      await increaseTime(24 * 60 * 60 - 3600);

      const transaction = await timeLock.getTxInfo(txId);
      const currentTimestamp = await getBlockTimestamp();

      await expect(timeLock.execute(txId))
        .to.be.revertedWithCustomError(timeLock, "TimeLock__TimestampNotPassed")
        .withArgs(currentTimestamp + 1, transaction.timestamp);
    });

    it("reverts if the time to execute has passed by more the `GRACE_PERIOD`", async function () {
      const [, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);
      const txId: string = await queueTx(timeLock, testTimeLock);

      // increasing time by 1 day + Grace period + 1 hour to check executing when timestamp is on the future
      await increaseTime(24 * 60 * 60 + GRACE_PERIOD + 3600);

      const transaction = await timeLock.getTxInfo(txId);
      const currentTimestamp = await getBlockTimestamp();

      await expect(timeLock.execute(txId))
        .to.be.revertedWithCustomError(timeLock, "TimeLock__TxExpired")
        .withArgs(currentTimestamp + 1, transaction.timestamp.add(GRACE_PERIOD));
    });
  });

  describe("#cancel", function () {
    it("should emit `Cancel` event on successful canceling a queued tx", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);

      const txId: string = await queueTx(timeLock, testTimeLock);

      // increasing time by 1 day + 1 hour to by in executing interval
      await increaseTime(24 * 60 * 60 + 3600);

      await expect(timeLock.cancel(txId)).to.emit(timeLock, "Cancel").withArgs(txId);
    });

    it("should update transaction status into `EXPIRED`", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);

      const txId: string = await queueTx(timeLock, testTimeLock);

      // increasing time by 1 day + 1 hour to by in executing interval
      await increaseTime(24 * 60 * 60 + 3600);

      await timeLock.cancel(txId);

      const transaction = await timeLock.getTxInfo(txId);

      assert.equal(transaction.status, 2 /* EXPIRED */);
    });

    it("revert if not the owner is trying to cancel the tranasaction", async function () {
      const [, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);

      const txId: string = await queueTx(timeLock, testTimeLock);

      // increasing time by 1 day + 1 hour to by in executing interval
      await increaseTime(24 * 60 * 60 + 3600);

      await expect(timeLock.connect(hacker).cancel(txId)).to.be.revertedWith(
        /Ownable: caller is not the owner/
      );
    });

    it("revert if the transaction is not in queue", async function () {
      const { timeLock, testTimeLock } = await loadFixture(deployTimeLockFixture);

      const timestampParam = await getBlockTimestamp();

      const txId: string = await timeLock.getTxId(
        testTimeLock.address,
        0,
        encodedFunction(testTimeLock, "getName"),
        timestampParam
      );

      await expect(timeLock.cancel(txId))
        .to.be.revertedWithCustomError(timeLock, "TimeLock__TxNotQueued")
        .withArgs(txId);
    });
  });
});
