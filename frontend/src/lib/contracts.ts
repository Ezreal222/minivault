import type { ContractRunner } from "ethers";
import { MiniUSD__factory } from "../types/factories/contracts/MiniUSD__factory";
import { Vault__factory } from "../types/factories/contracts/Vault__factory";
import { OracleAdapter__factory } from "../types/factories/contracts/OracleAdapter.sol/OracleAdapter__factory";
import addresses from "./addresses.json";

export const ADDRESSES = addresses;

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_HEX = "0xaa36a7";

export const SEPOLIA_PARAMS = {
  chainId: SEPOLIA_HEX,
  chainName: "Sepolia",
  nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

export function makeContracts(runner: ContractRunner) {
  return {
    miniUSD: MiniUSD__factory.connect(ADDRESSES.MiniUSD, runner),
    vault: Vault__factory.connect(ADDRESSES.Vault, runner),
    oracle: OracleAdapter__factory.connect(ADDRESSES.OracleAdapter, runner),
  };
}

export type Contracts = ReturnType<typeof makeContracts>;
