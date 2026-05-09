import { expect } from "chai";
import { ethers } from "hardhat";

describe("MiniUSD", () => {
  async function deploy() {
    const [deployer, vault, alice, bob] = await ethers.getSigners();
    const MiniUSD = await ethers.getContractFactory("MiniUSD");
    const token = await MiniUSD.deploy();
    await token.waitForDeployment();
    return { token, deployer, vault, alice, bob };
  }

  describe("metadata", () => {
    it("has the correct name, symbol, and 18 decimals", async () => {
      const { token } = await deploy();
      expect(await token.name()).to.equal("MiniUSD");
      expect(await token.symbol()).to.equal("mUSD");
      expect(await token.decimals()).to.equal(18);
      expect(await token.totalSupply()).to.equal(0);
    });
  });

  describe("setVault — one-shot setup", () => {
    it("starts with vault unset (zero address)", async () => {
      const { token } = await deploy();
      expect(await token.vault()).to.equal(ethers.ZeroAddress);
    });

    it("allows setVault to be called once", async () => {
      const { token, vault } = await deploy();
      await token.setVault(vault.address);
      expect(await token.vault()).to.equal(vault.address);
    });

    it("reverts when setVault is called a second time", async () => {
      const { token, vault, alice } = await deploy();
      await token.setVault(vault.address);
      await expect(token.setVault(alice.address)).to.be.revertedWith(
        "Vault already set",
      );
    });
  });

  describe("mint — only Vault can mint", () => {
    it("lets the vault mint to any address", async () => {
      const { token, vault, alice } = await deploy();
      await token.setVault(vault.address);

      await expect(token.connect(vault).mint(alice.address, 1000n))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, alice.address, 1000n);

      expect(await token.balanceOf(alice.address)).to.equal(1000n);
      expect(await token.totalSupply()).to.equal(1000n);
    });

    it("reverts with OnlyVault when a non-vault tries to mint", async () => {
      const { token, vault, alice } = await deploy();
      await token.setVault(vault.address);

      await expect(
        token.connect(alice).mint(alice.address, 1000n),
      ).to.be.revertedWithCustomError(token, "OnlyVault");
    });

    it("reverts with OnlyVault before setVault has been called", async () => {
      const { token, deployer, alice } = await deploy();
      // Deployer is also not the vault since vault == address(0)
      await expect(
        token.connect(deployer).mint(alice.address, 1000n),
      ).to.be.revertedWithCustomError(token, "OnlyVault");
    });
  });

  describe("burn — only Vault can burn", () => {
    it("lets the vault burn from a holder", async () => {
      const { token, vault, alice } = await deploy();
      await token.setVault(vault.address);
      await token.connect(vault).mint(alice.address, 1000n);

      await expect(token.connect(vault).burn(alice.address, 400n))
        .to.emit(token, "Transfer")
        .withArgs(alice.address, ethers.ZeroAddress, 400n);

      expect(await token.balanceOf(alice.address)).to.equal(600n);
      expect(await token.totalSupply()).to.equal(600n);
    });

    it("reverts with OnlyVault when a non-vault tries to burn", async () => {
      const { token, vault, alice, bob } = await deploy();
      await token.setVault(vault.address);
      await token.connect(vault).mint(alice.address, 1000n);

      await expect(
        token.connect(bob).burn(alice.address, 400n),
      ).to.be.revertedWithCustomError(token, "OnlyVault");
    });
  });
});
