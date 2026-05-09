import { expect } from "chai";
import { ethers } from "hardhat";

// Helpers — keep prices in human-readable USD then scale.
const toFeedPrice = (usd: number) => BigInt(usd) * 10n ** 8n;     // 8-dec feed
const usd = (n: number | bigint) => ethers.parseUnits(n.toString(), 18); // mUSD has 18 dec

describe("Vault", () => {
  // Default: ETH at $2000. With 1 ETH collateral and 150% MCR, max debt = ~$1333.
  async function deploy(initialPriceUSD = 2000) {
    const [deployer, alice, bob, liquidator] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockAggregator");
    const mock = await Mock.deploy(toFeedPrice(initialPriceUSD));
    await mock.waitForDeployment();

    const Oracle = await ethers.getContractFactory("OracleAdapter");
    const oracle = await Oracle.deploy(await mock.getAddress());
    await oracle.waitForDeployment();

    const MiniUSD = await ethers.getContractFactory("MiniUSD");
    const stable = await MiniUSD.deploy();
    await stable.waitForDeployment();

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(
      await stable.getAddress(),
      await oracle.getAddress(),
    );
    await vault.waitForDeployment();

    await stable.setVault(await vault.getAddress());

    return { mock, oracle, stable, vault, deployer, alice, bob, liquidator };
  }

  describe("depositCollateral", () => {
    it("credits the sender and emits Deposited", async () => {
      const { vault, alice } = await deploy();
      const amount = ethers.parseEther("1");

      await expect(vault.connect(alice).depositCollateral({ value: amount }))
        .to.emit(vault, "Deposited")
        .withArgs(alice.address, amount);

      const [collateral, debt] = await vault.positions(alice.address);
      expect(collateral).to.equal(amount);
      expect(debt).to.equal(0);
    });

    it("reverts on zero deposit", async () => {
      const { vault, alice } = await deploy();
      await expect(
        vault.connect(alice).depositCollateral({ value: 0 }),
      ).to.be.revertedWith("Zero deposit");
    });

    it("accepts ETH via plain transfer (receive())", async () => {
      const { vault, alice } = await deploy();
      const amount = ethers.parseEther("0.5");
      await alice.sendTransaction({ to: await vault.getAddress(), value: amount });
      const [collateral] = await vault.positions(alice.address);
      expect(collateral).to.equal(amount);
    });
  });

  describe("happy-path round trip — deposit → mint → repay → withdraw", () => {
    it("walks the full lifecycle and zeros out the position", async () => {
      const { vault, stable, alice } = await deploy(2000);
      const collateral = ethers.parseEther("1"); // worth $2000
      const mintAmt = usd(1000); // ~200% ratio (healthy)
      const repayAmt = usd(1000);

      // Deposit
      await vault.connect(alice).depositCollateral({ value: collateral });

      // Mint
      await expect(vault.connect(alice).mintStablecoin(mintAmt))
        .to.emit(vault, "Minted")
        .withArgs(alice.address, mintAmt);
      expect(await stable.balanceOf(alice.address)).to.equal(mintAmt);

      // Repay
      await expect(vault.connect(alice).repay(repayAmt))
        .to.emit(vault, "Repaid")
        .withArgs(alice.address, repayAmt);
      expect(await stable.balanceOf(alice.address)).to.equal(0);

      // Withdraw — debt is now zero, so withdrawing all collateral is allowed.
      const balBefore = await ethers.provider.getBalance(alice.address);
      const tx = await vault.connect(alice).withdrawCollateral(collateral);
      const rcpt = await tx.wait();
      const gas = rcpt!.gasUsed * rcpt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(alice.address);

      expect(balAfter - balBefore + gas).to.equal(collateral);

      const [collAfter, debtAfter] = await vault.positions(alice.address);
      expect(collAfter).to.equal(0);
      expect(debtAfter).to.equal(0);
    });
  });

  describe("mintStablecoin — collateralization", () => {
    it("reverts with Undercollateralized when minting above the 150% ratio", async () => {
      const { vault, alice } = await deploy(2000);
      // 1 ETH collateral = $2000. Max debt at 150% = $1333.33.
      // Minting $1500 must revert.
      await vault.connect(alice).depositCollateral({
        value: ethers.parseEther("1"),
      });

      await expect(
        vault.connect(alice).mintStablecoin(usd(1500)),
      ).to.be.revertedWithCustomError(vault, "Undercollateralized");
    });

    it("allows minting up to the 150% boundary", async () => {
      const { vault, alice, stable } = await deploy(2000);
      // $2000 / 1.5 = 1333.33... — mint exactly $1333 (safely under the floor).
      await vault.connect(alice).depositCollateral({
        value: ethers.parseEther("1"),
      });
      const safeMint = usd(1333);
      await vault.connect(alice).mintStablecoin(safeMint);
      expect(await stable.balanceOf(alice.address)).to.equal(safeMint);
    });
  });

  describe("withdrawCollateral", () => {
    it("reverts with InsufficientCollateral when withdrawing more than deposited", async () => {
      const { vault, alice } = await deploy();
      await vault.connect(alice).depositCollateral({
        value: ethers.parseEther("1"),
      });
      await expect(
        vault.connect(alice).withdrawCollateral(ethers.parseEther("2")),
      ).to.be.revertedWithCustomError(vault, "InsufficientCollateral");
    });

    it("reverts with Undercollateralized if withdrawal would breach the 150% ratio", async () => {
      const { vault, alice } = await deploy(2000);
      // Deposit 1 ETH ($2000), mint $1000 mUSD → ratio = 200%.
      await vault.connect(alice).depositCollateral({
        value: ethers.parseEther("1"),
      });
      await vault.connect(alice).mintStablecoin(usd(1000));

      // Required collateral = debt * 150% / price = 1000 * 1.5 / 2000 = 0.75 ETH.
      // Withdrawing 0.5 ETH leaves 0.5 ETH = $1000 vs $1500 needed → revert.
      await expect(
        vault.connect(alice).withdrawCollateral(ethers.parseEther("0.5")),
      ).to.be.revertedWithCustomError(vault, "Undercollateralized");
    });

    it("succeeds when the remaining collateral still satisfies the ratio", async () => {
      const { vault, alice } = await deploy(2000);
      // Deposit 1 ETH, mint $500 → required collateral 0.375 ETH.
      // Withdrawing 0.4 ETH leaves 0.6 ETH worth $1200 vs $750 needed → ok.
      await vault.connect(alice).depositCollateral({
        value: ethers.parseEther("1"),
      });
      await vault.connect(alice).mintStablecoin(usd(500));

      await expect(
        vault.connect(alice).withdrawCollateral(ethers.parseEther("0.4")),
      ).to.emit(vault, "Withdrawn").withArgs(alice.address, ethers.parseEther("0.4"));

      const [collateral] = await vault.positions(alice.address);
      expect(collateral).to.equal(ethers.parseEther("0.6"));
    });
  });

  describe("liquidate", () => {
    it("reverts with PositionHealthy on a healthy position", async () => {
      const { vault, alice, liquidator } = await deploy(2000);
      await vault.connect(alice).depositCollateral({
        value: ethers.parseEther("1"),
      });
      await vault.connect(alice).mintStablecoin(usd(1000)); // 200% — healthy

      await expect(
        vault.connect(liquidator).liquidate(alice.address),
      ).to.be.revertedWithCustomError(vault, "PositionHealthy");
    });

    it("reverts with PositionHealthy when the user has no debt", async () => {
      const { vault, alice, liquidator } = await deploy();
      // No deposit, no debt — debtUSD = 0 → _isHealthy returns true.
      await expect(
        vault.connect(liquidator).liquidate(alice.address),
      ).to.be.revertedWithCustomError(vault, "PositionHealthy");
    });

    it("liquidates an underwater position when the price drops", async () => {
      const { vault, mock, stable, alice, liquidator } = await deploy(2000);

      // Alice opens a 200% position: 1 ETH @ $2000 = $2000 vs $1000 debt.
      const collateral = ethers.parseEther("1");
      const debt = usd(1000);
      await vault.connect(alice).depositCollateral({ value: collateral });
      await vault.connect(alice).mintStablecoin(debt);

      // Alice transfers her mUSD to the liquidator so they can burn it.
      await stable.connect(alice).transfer(liquidator.address, debt);

      // Price crashes to $1000 → ratio drops to 100%, well under 150%.
      await mock.setPrice(toFeedPrice(1000));

      const liqEthBefore = await ethers.provider.getBalance(liquidator.address);

      await expect(vault.connect(liquidator).liquidate(alice.address))
        .to.emit(vault, "Liquidated")
        .withArgs(alice.address, liquidator.address, collateral, debt);

      const liqEthAfter = await ethers.provider.getBalance(liquidator.address);

      // Liquidator's mUSD should be burned, position zeroed, collateral seized.
      expect(await stable.balanceOf(liquidator.address)).to.equal(0);
      const [collAfter, debtAfter] = await vault.positions(alice.address);
      expect(collAfter).to.equal(0);
      expect(debtAfter).to.equal(0);

      // Net ETH gain ≈ collateral (modulo gas). Allow a small gas tolerance.
      const tolerance = ethers.parseEther("0.01");
      expect(liqEthAfter - liqEthBefore).to.be.gt(collateral - tolerance);
    });
  });

  describe("healthFactor view", () => {
    it("returns max-uint when there is no debt", async () => {
      const { vault, alice } = await deploy();
      expect(await vault.healthFactor(alice.address)).to.equal(ethers.MaxUint256);
    });

    it("reflects the current collateral / debt ratio in percent", async () => {
      const { vault, alice } = await deploy(2000);
      await vault.connect(alice).depositCollateral({
        value: ethers.parseEther("1"),
      });
      await vault.connect(alice).mintStablecoin(usd(1000)); // 200%
      expect(await vault.healthFactor(alice.address)).to.equal(200n);
    });
  });

  describe("repay", () => {
    it("reverts when repay exceeds outstanding debt", async () => {
      const { vault, alice } = await deploy();
      await vault.connect(alice).depositCollateral({
        value: ethers.parseEther("1"),
      });
      await vault.connect(alice).mintStablecoin(usd(500));
      await expect(vault.connect(alice).repay(usd(600))).to.be.revertedWith(
        "Repay exceeds debt",
      );
    });
  });
});
