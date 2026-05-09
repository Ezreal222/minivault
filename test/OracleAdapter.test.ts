import { expect } from "chai";
import { ethers, network } from "hardhat";

// Chainlink ETH/USD feeds report 8 decimals — the mock matches that.
// The adapter scales to 18 decimals internally, so an 8-dec input of $2000
// (= 2000e8) becomes 2000e18 on output.
const toFeedPrice = (usd: number) => BigInt(usd) * 10n ** 8n;
const toScaledPrice = (usd: number) => BigInt(usd) * 10n ** 18n;

describe("OracleAdapter", () => {
  async function deploy(initialPriceUSD = 2000) {
    const [deployer, alice] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockAggregator");
    const mock = await Mock.deploy(toFeedPrice(initialPriceUSD));
    await mock.waitForDeployment();

    const Oracle = await ethers.getContractFactory("OracleAdapter");
    const oracle = await Oracle.deploy(await mock.getAddress());
    await oracle.waitForDeployment();

    return { mock, oracle, deployer, alice };
  }

  describe("peekPriceUSD", () => {
    // The guide lists "peeks price > 0 on Sepolia fork" as a sanity test;
    // we exercise the same code path against the MockAggregator so the
    // suite stays self-contained (no Sepolia RPC required).
    it("returns the live price scaled to 18 decimals", async () => {
      const { oracle } = await deploy(2000);
      const price = await oracle.peekPriceUSD();
      expect(price).to.equal(toScaledPrice(2000));
      expect(price).to.be.gt(0);
    });

    it("returns 0 if the underlying feed reports a non-positive price", async () => {
      const { mock, oracle } = await deploy(2000);
      await mock.setPrice(0);
      expect(await oracle.peekPriceUSD()).to.equal(0);
    });
  });

  describe("getPriceUSD — happy path", () => {
    it("returns the scaled price and updates lastPrice / lastBlockSeen", async () => {
      const { oracle } = await deploy(2000);

      const tx = await oracle.getPriceUSD();
      const receipt = await tx.wait();

      expect(await oracle.lastPrice()).to.equal(toScaledPrice(2000));
      expect(await oracle.lastBlockSeen()).to.equal(receipt!.blockNumber);
      expect(await oracle.tripped()).to.equal(false);
    });

    it("accepts a small inter-block move without tripping", async () => {
      const { mock, oracle } = await deploy(2000);
      await oracle.getPriceUSD(); // mines block N

      // 2% move in a later block — same-block guard does not apply.
      await mock.setPrice(toFeedPrice(2040));
      await oracle.getPriceUSD();

      expect(await oracle.tripped()).to.equal(false);
      expect(await oracle.lastPrice()).to.equal(toScaledPrice(2040));
    });
  });

  describe("getPriceUSD — failure modes", () => {
    it("reverts with InvalidPrice when the feed returns a non-positive answer", async () => {
      const { mock, oracle } = await deploy(2000);
      await mock.setPrice(0);
      await expect(oracle.getPriceUSD())
        .to.be.revertedWithCustomError(oracle, "InvalidPrice")
        .withArgs(0);

      await mock.setPrice(-1);
      await expect(oracle.getPriceUSD())
        .to.be.revertedWithCustomError(oracle, "InvalidPrice")
        .withArgs(-1);
    });

    it("reverts with StalePrice when updatedAt is older than the threshold", async () => {
      const { mock, oracle } = await deploy(2000);
      await mock.setStale(); // mock backdates updatedAt by 2hr (> 1hr threshold)
      await expect(oracle.getPriceUSD()).to.be.revertedWithCustomError(
        oracle,
        "StalePrice",
      );
    });
  });

  describe("circuit breaker — same-block move", () => {
    // We use an OracleTrigger helper that calls getPriceUSD() twice with a
    // setPrice() sandwiched in between, all in ONE transaction. A single tx
    // is by definition one block, so this is the cleanest way to drive the
    // `block.number == lastBlockSeen` branch deterministically.
    async function deployTrigger() {
      const { mock, oracle } = await deploy(2000);
      const Trigger = await ethers.getContractFactory("OracleTrigger");
      const trigger = await Trigger.deploy();
      await trigger.waitForDeployment();
      return { mock, oracle, trigger };
    }

    it("does NOT trip on a small same-block move (< 5%)", async () => {
      const { mock, oracle, trigger } = await deployTrigger();

      // +4% bump (2000 → 2080), under the 5% threshold.
      await trigger.pumpAndCheck(
        await oracle.getAddress(),
        await mock.getAddress(),
        toFeedPrice(2080),
      );

      expect(await oracle.tripped()).to.equal(false);
      expect(await oracle.lastPrice()).to.equal(toScaledPrice(2080));
    });

    it("trips and reverts with CircuitBreakerTripped on >5% same-block move", async () => {
      const { mock, oracle, trigger } = await deployTrigger();

      // +10% bump (2000 → 2200) — well above the 5% threshold.
      await expect(
        trigger.pumpAndCheck(
          await oracle.getAddress(),
          await mock.getAddress(),
          toFeedPrice(2200),
        ),
      ).to.be.revertedWithCustomError(oracle, "CircuitBreakerTripped");

      // NOTE: the revert rolls back the `tripped = true` write made just
      // before the revert in the same tx, so storage stays false. The
      // user-visible guarantee is that the offending call reverts and no
      // consumer (e.g. Vault) ever sees a manipulated price.
      expect(await oracle.tripped()).to.equal(false);
    });

    it("blocks subsequent getPriceUSD once `tripped` is true", async () => {
      // Force `tripped = true` via storage to cover the early-revert branch
      // deterministically (the in-tx trip is rolled back, see test above).
      const { oracle } = await deploy(2000);
      // Storage layout: slot 0 = lastPrice, slot 1 = lastBlockSeen,
      // slot 2 = tripped (immutables/constants take no slot).
      await network.provider.send("hardhat_setStorageAt", [
        await oracle.getAddress(),
        "0x2",
        "0x" + "0".repeat(63) + "1",
      ]);

      expect(await oracle.tripped()).to.equal(true);
      await expect(oracle.getPriceUSD()).to.be.revertedWithCustomError(
        oracle,
        "CircuitBreakerTripped",
      );
    });
  });
});
