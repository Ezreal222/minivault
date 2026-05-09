import { ethers, network, run } from "hardhat";

const SEPOLIA_ETH_USD = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. MiniUSD
  const MiniUSD = await ethers.getContractFactory("MiniUSD");
  const stablecoin = await MiniUSD.deploy();
  await stablecoin.waitForDeployment();
  const stableAddr = await stablecoin.getAddress();
  console.log("MiniUSD:", stableAddr);

  // 2. OracleAdapter
  const Oracle = await ethers.getContractFactory("OracleAdapter");
  const oracle = await Oracle.deploy(SEPOLIA_ETH_USD);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("OracleAdapter:", oracleAddr);

  // 3. Vault
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(stableAddr, oracleAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("Vault:", vaultAddr);

  // 4. Wire up MiniUSD -> Vault
  const tx = await stablecoin.setVault(vaultAddr);
  await tx.wait();
  console.log("Vault wired into MiniUSD");

  // 5. Verify on Etherscan
  if (network.name === "sepolia") {
    console.log("Waiting 30s before verification…");
    await new Promise(r => setTimeout(r, 30_000));
    await run("verify:verify", { address: stableAddr, constructorArguments: [] });
    await run("verify:verify", { address: oracleAddr, constructorArguments: [SEPOLIA_ETH_USD] });
    await run("verify:verify", { address: vaultAddr, constructorArguments: [stableAddr, oracleAddr] });
  }

  // 6. Save addresses for the frontend
  const fs = await import("fs");
  fs.writeFileSync(
    "frontend/src/lib/addresses.json",
    JSON.stringify({ MiniUSD: stableAddr, OracleAdapter: oracleAddr, Vault: vaultAddr }, null, 2),
  );
  console.log("Addresses saved to frontend/src/lib/addresses.json");
}

main().catch((e) => { console.error(e); process.exit(1); });