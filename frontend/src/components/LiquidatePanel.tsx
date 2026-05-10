import { useState } from "react";
import { isAddress } from "ethers";
import type { Contracts } from "../lib/contracts";
import type { BannerState } from "./ActionPanel";
import { fmt, fmtUSD, healthTier, tierColor, tierLabel } from "../lib/format";
import type { VaultData } from "../hooks/useVault";

interface Props {
  contracts: Contracts | null;
  ownData: VaultData;
  setBanner: (b: BannerState) => void;
  onAction: () => void;
}

interface Probe {
  collateralETH: bigint;
  debtUSD: bigint;
  healthFactor: bigint;
}

export function LiquidatePanel({ contracts, ownData, setBanner, onAction }: Props) {
  const [target, setTarget] = useState("");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probing, setProbing] = useState(false);
  const [busy, setBusy] = useState(false);

  const validAddr = isAddress(target);

  async function check() {
    if (!contracts || !validAddr) return;
    setProbing(true);
    setProbe(null);
    try {
      const [pos, hf] = await Promise.all([
        contracts.vault.positions(target),
        contracts.vault.healthFactor(target),
      ]);
      setProbe({ collateralETH: pos[0], debtUSD: pos[1], healthFactor: hf });
    } catch (e) {
      console.error(e);
      setBanner({ kind: "error", text: "Failed to read target position." });
    } finally {
      setProbing(false);
    }
  }

  async function liquidate() {
    if (!contracts || !validAddr || !probe) return;
    setBusy(true);
    setBanner({ kind: "pending", text: "Awaiting wallet signature…" });
    try {
      const tx = await contracts.vault.liquidate(target);
      setBanner({
        kind: "pending",
        text: "Liquidation broadcast — waiting for confirmation…",
        hash: tx.hash,
      });
      await tx.wait();
      setBanner({ kind: "success", text: "Liquidation confirmed.", hash: tx.hash });
      setProbe(null);
      onAction();
    } catch (e: any) {
      const msg = (e?.shortMessage ?? e?.reason ?? e?.message ?? "Failed").toLowerCase();
      if (msg.includes("positionhealthy"))
        setBanner({ kind: "error", text: "Position is healthy — cannot liquidate." });
      else if (msg.includes("erc20insufficientbalance"))
        setBanner({
          kind: "error",
          text: "You don't hold enough mUSD to burn this debt.",
        });
      else if (msg.includes("user rejected"))
        setBanner({ kind: "error", text: "Transaction rejected." });
      else setBanner({ kind: "error", text: e?.shortMessage ?? e?.message ?? "Failed" });
    } finally {
      setBusy(false);
    }
  }

  const tier = probe ? healthTier(probe.healthFactor) : "none";
  const liquidatable = probe && probe.debtUSD > 0n && probe.healthFactor < 150n;
  const haveEnoughMUSD = probe ? ownData.mUSDBalance >= probe.debtUSD : false;

  return (
    <section className="space-y-5 animate-fade-up [animation-delay:480ms]">
      <div className="flex items-center gap-3">
        <span className="hairline-solid flex-1" />
        <span className="eyebrow text-ink-400">Liquidate · Advanced</span>
        <span className="hairline-solid flex-1" />
      </div>

      <p className="text-xs text-ink-400 leading-relaxed">
        Liquidating a position with HF &lt; 150% burns the borrower&apos;s full
        debt from <em className="text-ink-100 not-italic">your</em> mUSD balance
        and seizes their collateral. You must hold enough mUSD to cover their
        debt before calling.
      </p>

      <div className="space-y-3">
        <div className="flex items-stretch border border-ink-700 focus-within:border-flame-400 transition-colors">
          <input
            type="text"
            placeholder="0x… target address"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value.trim());
              setProbe(null);
            }}
            className="flex-1 bg-transparent px-4 py-3 font-mono text-sm text-ink-50 placeholder-ink-500 focus:outline-none"
          />
          <button
            onClick={check}
            disabled={!contracts || !validAddr || probing}
            className="px-4 border-l border-ink-700 eyebrow text-flame-400 hover:bg-flame-400 hover:text-ink-950 disabled:text-ink-500 disabled:hover:bg-transparent transition-colors"
          >
            {probing ? "Probing…" : "Check"}
          </button>
        </div>

        {target && !validAddr && (
          <p className="text-xs text-rust-400">Not a valid address.</p>
        )}
      </div>

      {probe && (
        <div className="border border-ink-700 p-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="eyebrow">Collateral</p>
              <p className="figure text-ink-50 mt-1">
                {fmt(probe.collateralETH, 18, 4)} ETH
              </p>
            </div>
            <div>
              <p className="eyebrow">Debt</p>
              <p className="figure text-ink-50 mt-1">
                {fmtUSD(probe.debtUSD)} mUSD
              </p>
            </div>
            <div>
              <p className="eyebrow">Health</p>
              <p className={`figure mt-1 ${tierColor(tier)}`}>
                {probe.debtUSD === 0n ? "∞" : `${probe.healthFactor.toString()}%`}
              </p>
            </div>
          </div>

          <div className="hairline-solid" />

          <div className="flex items-center justify-between">
            <span className={`eyebrow ${tierColor(tier)}`}>{tierLabel(tier)}</span>
            {!liquidatable && (
              <span className="eyebrow text-ink-500">
                {probe.debtUSD === 0n ? "no debt" : "above 150% — safe"}
              </span>
            )}
            {liquidatable && !haveEnoughMUSD && (
              <span className="eyebrow text-rust-400">
                NEED {fmtUSD(probe.debtUSD - ownData.mUSDBalance)} MORE mUSD
              </span>
            )}
          </div>

          <button
            onClick={liquidate}
            disabled={!liquidatable || !haveEnoughMUSD || busy}
            className="w-full border border-rust-400 bg-rust-400 text-ink-950 py-3 text-xs tracking-widest uppercase font-bold hover:bg-rust-500 hover:border-rust-500 disabled:bg-ink-900 disabled:border-ink-700 disabled:text-ink-500 transition-colors"
          >
            {busy ? "Liquidating…" : "Execute Liquidation"}
          </button>
        </div>
      )}
    </section>
  );
}
