import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const { ALCHEMY_SEPOLIA_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sepolia: {
      url: ALCHEMY_SEPOLIA_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "",
  },
  typechain: {
    outDir: "frontend/src/types",   // emit types directly into frontend
    target: "ethers-v6",
  },
};

export default config;