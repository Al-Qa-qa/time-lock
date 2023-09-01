import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { TimeLock, TestTimeLock } from "../typechain-types";
import { MIN_DELAY } from "../helper-hardhat-config";
import { BigNumber } from "ethers";
import encodedFunction from "../utils/encodingFunction";
import { ContractTransaction, ContractReceipt } from "ethers/src.ts/ethers";

// ---

// You should a valid transaction ID here, where you will get it when running `queue.ts` file
const txId = "0xb86152a18d23214403afa1f02132a6e80a2ac392d74a3ccc07e2dc18cfb87b6b";

async function cancel() {
  const [deployer] = await ethers.getSigners();
  const networkName: string = network.name;
  const contracts = Object(jsonContracts);
  if (!contracts[networkName].TimeLock) {
    throw new Error("Contract is not deployed yet");
  }
  if (networkName === "hardhat") {
    throw new Error("Can't run scripts to hardhat network deployed contract");
  }
  const timeLock: TimeLock = await ethers.getContractAt(
    "TimeLock",
    contracts[networkName].TimeLock,
    deployer
  );

  const testTimeLock: TestTimeLock = await ethers.getContractAt(
    "TestTimeLock",
    contracts[networkName].TestTimeLock,
    deployer
  );

  try {
    // Canceling a transaction

    await timeLock.cancel(txId);

    console.log(`transaction with ID: ${txId}, has been canceled successfully`);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error(`Failed to cancel the transaction`);
  }

  return timeLock;
}

cancel()
  .then((_timeLock) => {
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
