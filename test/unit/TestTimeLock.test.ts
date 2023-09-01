import { expect, assert } from "chai";
import { ethers, network } from "hardhat";
import { TestTimeLock, TestTimeLock__factory } from "../../typechain-types";

// Function
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Data
import { ADDRESS_ZERO, developmentChains } from "../../helper-hardhat-config";

// Types
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractTransaction, ContractReceipt } from "ethers/src.ts/ethers";
import { BigNumber } from "ethers";

// ------------

describe("TestTimeLock", function () {
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
    testTimeLock: TestTimeLock;
  };
  async function deployTokenFixture(): Promise<DeployFixture> {
    const [deployer]: SignerWithAddress[] = await ethers.getSigners();

    const testTimeLockFactory: TestTimeLock__factory = await ethers.getContractFactory(
      "TestTimeLock",
      deployer
    );
    const testTimeLock: TestTimeLock = await testTimeLockFactory.deploy();
    await testTimeLock.deployed();

    return { deployer, testTimeLock };
  }

  describe("#general", function () {
    it("should set name successfully when using `setName(string)` function", async function () {
      const { deployer, testTimeLock } = await loadFixture(deployTokenFixture);

      const newName = "Al-Qa'qa'";

      await testTimeLock.setName(newName);

      const name: string = await testTimeLock.getName();

      assert.equal(name, newName);
    });
  });
});
