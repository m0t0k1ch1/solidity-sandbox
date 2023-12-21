import { HardhatUserConfig } from "hardhat/config";

import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.23",
  networks: {
    sepolia: {
      url: "https://rpc.sepolia.org",
    },
  },
  gasReporter: {
    enabled: true,
  },
};

export default config;
