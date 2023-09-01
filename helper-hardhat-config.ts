import { ethers, BigNumber } from "ethers";

type NetworkConfigItem = {
  name: string;
};

type NetworkConfigMap = {
  [chainId: string]: NetworkConfigItem;
};

export const networkConfig: NetworkConfigMap = {
  default: {
    name: "hardhat",
  },
  31337: {
    name: "localhost",
  },
  1: {
    name: "mainnet",
  },
  11155111: {
    name: "sepolia",
  },
  137: {
    name: "polygon",
  },
};

export const MIN_DELAY = 24 * 60 * 60; // 1 day
export const MAX_DELAY = 30 * 24 * 60 * 60; // 30 days
export const GRACE_PERIOD = 7 * 24 * 60 * 60; // 7 days
export const FUNC = "getName()";

export const ADDRESS_ZERO = ethers.constants.AddressZero;

export const developmentChains: string[] = ["hardhat", "localhost"];
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6;
