// Packages
import * as fs from "fs";
import * as path from "path";
import { ethers, network } from "hardhat";

// Functions
import { log, verify } from "../../helper-functions";

// Data
import { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } from "../../helper-hardhat-config";

// Types
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { TestTimeLock, TestTimeLock__factory } from "../../typechain-types";
import { BigNumber } from "ethers";
/**
 * Type of the deployed contract that will be stored in deployed-contracts.json file
 *
 * example:
 *  {
 *    "hardhat": {
 *      "contractName": "contractAddress"
 *    }
 *  }
 */
type DeployedContracts = {
  [key: string]: {
    [key: string]: string;
  };
};

/**
 * Deploy SimpleStorage Contract
 *
 * @param chainId the Id of the network we will deploy on it
 * @returns the deployed contract
 */
async function deployTestTimeLock(chainId: number) {
  const [deployer, owner1, owner2, owner3]: SignerWithAddress[] = await ethers.getSigners();

  if (developmentChains.includes(network.name)) {
    // Deploy MOCKS if existed
    // You will use chainId to get info of the chain from hardhat-helper-config file
  } else {
    // Do additional thing in case its not a testnet
  }

  // Deploying The Contract
  log(`Deploying contract with the account: ${deployer.address}`);
  const testTimeLockFactory: TestTimeLock__factory = await ethers.getContractFactory(
    "TestTimeLock",
    deployer
  );
  log("Deploying Contract...");
  const testTimeLock: TestTimeLock = await testTimeLockFactory.deploy();
  await testTimeLock.deployed();

  log(`TestTimeLock deployed to: ${testTimeLock.address}`);
  log("", "separator");

  if (!developmentChains.includes(network.name)) {
    // Verify Contract if it isnt in a development chain
    log("Verifying Contract", "title");
    await testTimeLock.deployTransaction.wait(VERIFICATION_BLOCK_CONFIRMATIONS);
    await verify(testTimeLock.address, []);
    log("verified successfully");
  }

  // Storing contract address to connect to it later
  log("Storing contract address", "title");
  const parentDir: string = path.resolve(__dirname, "../../");
  const deployedContractsPath: string = path.join(parentDir, "deployed-contracts.json");
  const oldContracts: DeployedContracts = JSON.parse(
    fs.readFileSync(deployedContractsPath, "utf8")
  );

  // Add the contract to the network we are deploying on it
  if (!oldContracts[network.name]) {
    oldContracts[network.name] = {};
  }
  (oldContracts[network.name].TestTimeLock = testTimeLock.address),
    // Save data in our deployed-contracts file
    fs.writeFileSync(deployedContractsPath, JSON.stringify(oldContracts, null, 2));
  log("Stored Succesfully");
  log("", "separator");
  return testTimeLock;
}

export default deployTestTimeLock;
