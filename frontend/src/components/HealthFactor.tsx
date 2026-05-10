import { fmt, fmtUSD, healthTier, tierColor, tierLabel } from "../lib/format";
import type { VaultData } from "../hooks/useVault";

interface Props {
  data: VaultData;
}

export function HealthFactor({ data }: Props) {
  const { collateralETH, debtUSD, healthFactor, ethPriceUSD } = data;

  const tier = healthTier(healthFactor);
  const tierClass = tierColor(tier);
  const label = tierLabel(tier);

  // Display HF as percent. For "no debt" the contract returns max-uint;
  // we show ∞ instead of an unreadable number.
  const hfDisplay =
    debtUSD === 0n ? "∞" : healthFactor.toString();

  // Collateral USD value (uses live oracle peek)
  const collateralUSD =
    ethPriceUSD > 0n
      ? (collateralETH * ethPriceUSD) / 10n ** 18n
      : 0n;

  // Visual gauge — clamp to [0, 400%] for the bar; segmented out of 10.
  const cappedPct = Number(
    debtUSD === 0n ? 400n : healthFactor > 400n ? 400n : healthFactor,
  );
  const filledSegments = Math.min(10, Math.round((cappedPct / 400) * 10));

  return (
    <section className="space-y-8 animate-fade-up [animation-delay:240ms]">
      {/* Eyebrow header */}
      <div className="flex items-center gap-3">
        <span className="hairline-solid flex-1" />
        <span className="eyebrow text-flame-400">Your Position</span>
        <span className="hairline-solid flex-1" />
      </div>

      {/* Two-column grid: collateral + debt */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-2 border-r border-ink-700 pr-6">
          <p className="eyebrow">Collateral</p>
          <p className="figure text-4xl text-ink-50">
            {fmt(collateralETH, 18, 4)}
            <span className="text-ink-500 text-base ml-2 tracking-normal">ETH</span>
          </p>
          <p className="text-xs text-ink-400 figure">
            ≈ ${fmtUSD(collateralUSD)}
          </p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Debt</p>
          <p className="figure text-4xl text-ink-50">
            {fmtUSD(debtUSD)}
            <span className="text-ink-500 text-base ml-2 tracking-normal">mUSD</span>
          </p>
          <p className="text-xs text-ink-400 figure">
            {debtUSD === 0n ? "no outstanding loan" : "outstanding loan"}
          </p>
        </div>
      </div>

      {/* Health factor — the dramatic centerpiece */}
      <div className="border border-ink-700 p-6 space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full opacity-[0.04]"
             style={{ background: tier === "danger" ? "#ff5a4d" : tier === "warn" ? "#ffb200" : "#3dd68c" }} />
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">Health Factor</p>
          <p className={`eyebrow ${tierClass}`}>{label}</p>
        </div>

        <div className="flex items-baseline gap-3">
          <span className={`serif-display text-7xl ${tierClass}`}>
            {hfDisplay}
          </span>
          {debtUSD > 0n && (
            <span className={`figure text-2xl ${tierClass}`}>%</span>
          )}
        </div>

        {/* Segmented gauge */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => {
            const filled = i < filledSegments;
            const isWarnZone = i < 4 && filled; // first 4 bars represent <160%
            return (
              <div
                key={i}
                className={`h-1.5 flex-1 transition-colors ${
                  filled
                    ? isWarnZone
                      ? tier === "danger"
                        ? "bg-rust-400"
                        : "bg-flame-400"
                      : "bg-moss-400/80"
                    : "bg-ink-700"
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] tracking-widest uppercase text-ink-500">
          <span>0%</span>
          <span className="text-flame-400">150% MIN</span>
          <span>400%+</span>
        </div>
      </div>
    </section>
  );
}
