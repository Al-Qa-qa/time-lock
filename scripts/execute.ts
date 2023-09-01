import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { TimeLock, TestTimeLock } from "../typechain-types";
import { MIN_DELAY } from "../helper-hardhat-config";
import { BigNumber } from "ethers";
import encodedFunction from "../utils/encodingFunction";
import { ContractTransaction, ContractReceipt } from "ethers/src.ts/ethers";
import increaseTime from "../utils/increase-time";
// ---

// You should enter a valid transaction ID here, where you will get it when running `queue.ts` file
const txId = "0xfe3debee5f538552ca2334e469bdc8bccf7fa5a3d8bb0bca3952c01c7e489954";

async function execute() {
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
    // Executing a transaction

    // increasing the time to be in the period where the transaction can be executed
    await increaseTime(MIN_DELAY + 3600);

    await timeLock.execute(txId);

    console.log(`transaction with ID: ${txId}, has been executed successfully`);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error(`Failed to execute the transaction`);
  }

  return timeLock;
}

execute()
  .then((_timeLock) => {
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
