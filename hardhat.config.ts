import { HardhatUserConfig } from "hardhat/config";

import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.23",
  networks: {
    sepolia: {
      url: "https://rpc.sepolia.org",
    },
  },
};

export default config;
