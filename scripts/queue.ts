import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { TimeLock, TestTimeLock } from "../typechain-types";
import { MIN_DELAY } from "../helper-hardhat-config";
import { BigNumber } from "ethers";
import encodedFunction from "../utils/encodingFunction";
import { ContractTransaction, ContractReceipt } from "ethers/src.ts/ethers";

// ---

async function queue() {
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
    // Queueing a transaction
    const blockNumber: number = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);

    const blockTimestamp: number = block.timestamp;
    const timestampParam: number = blockTimestamp + MIN_DELAY + 3600;

    const queueTx: ContractTransaction = await timeLock.queue(
      testTimeLock.address,
      0,
      encodedFunction(testTimeLock, "getName"),
      timestampParam
    );

    const queueTxReceipt: ContractReceipt = await queueTx.wait(1);

    const txId: string = queueTxReceipt.events?.[0]?.args?.txId as string;

    console.log(`New transaction queued with ID: ${txId}`);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error(`Failed to queue the transaction`);
  }

  return timeLock;
}

queue()
  .then((_timeLock) => {
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
