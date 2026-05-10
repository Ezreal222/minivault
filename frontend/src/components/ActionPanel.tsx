import { useMemo, useState } from "react";
import { parseEther } from "ethers";
import type { Contracts } from "../lib/contracts";
import { fmt, fmtUSD, parse } from "../lib/format";
import type { VaultData } from "../hooks/useVault";

type ActionKey = "deposit" | "mint" | "repay" | "withdraw";

interface Props {
  contracts: Contracts | null;
  data: VaultData;
  onAction: () => void;            // refresh trigger after success
  setBanner: (b: BannerState) => void;
}

export interface BannerState {
  kind: "info" | "success" | "error" | "pending";
  text: string;
  hash?: string;
}

const TABS: { key: ActionKey; label: string; unit: string }[] = [
  { key: "deposit",  label: "Deposit",  unit: "ETH"  },
  { key: "mint",     label: "Mint",     unit: "mUSD" },
  { key: "repay",    label: "Repay",    unit: "mUSD" },
  { key: "withdraw", label: "Withdraw", unit: "ETH"  },
];

export function ActionPanel({ contracts, data, onAction, setBanner }: Props) {
  const [tab, setTab] = useState<ActionKey>("deposit");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const active = TABS.find((t) => t.key === tab)!;

  const max = useMemo(() => {
    switch (tab) {
      case "deposit":
        // leave a buffer for gas
        return data.ethBalance > parseEther("0.001")
          ? data.ethBalance - parseEther("0.001")
          : 0n;
      case "mint": {
        // theoretical max debt at 150%: collateralUSD * 100/150 - existingDebt
        if (data.ethPriceUSD === 0n) return 0n;
        const collateralUSD = (data.collateralETH * data.ethPriceUSD) / 10n ** 18n;
        const cap = (collateralUSD * 100n) / 150n;
        return cap > data.debtUSD ? cap - data.debtUSD : 0n;
      }
      case "repay":
        return data.mUSDBalance < data.debtUSD ? data.mUSDBalance : data.debtUSD;
      case "withdraw":
        return data.collateralETH;
    }
  }, [tab, data]);

  async function submit() {
    if (!contracts) return;
    const amount = parse(input, 18);
    if (amount <= 0n) {
      setBanner({ kind: "error", text: "Enter a positive amount." });
      return;
    }
    setBusy(true);
    setBanner({ kind: "pending", text: `Awaiting wallet signature for ${active.label.toLowerCase()}…` });

    try {
      let tx;
      switch (tab) {
        case "deposit":
          tx = await contracts.vault.depositCollateral({ value: amount });
          break;
        case "mint":
          tx = await contracts.vault.mintStablecoin(amount);
          break;
        case "repay":
          tx = await contracts.vault.repay(amount);
          break;
        case "withdraw":
          tx = await contracts.vault.withdrawCollateral(amount);
          break;
      }

      setBanner({
        kind: "pending",
        text: `Transaction broadcast — waiting for confirmation…`,
        hash: tx.hash,
      });

      await tx.wait();

      setBanner({
        kind: "success",
        text: `${active.label} confirmed.`,
        hash: tx.hash,
      });
      setInput("");
      onAction();
    } catch (e: any) {
      const msg =
        e?.shortMessage ??
        e?.reason ??
        e?.info?.error?.message ??
        e?.message ??
        "Transaction failed.";
      setBanner({ kind: "error", text: friendlyError(msg) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 animate-fade-up [animation-delay:360ms]">
      <div className="flex items-center gap-3">
        <span className="hairline-solid flex-1" />
        <span className="eyebrow text-flame-400">Actions</span>
        <span className="hairline-solid flex-1" />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 border border-ink-700 divide-x divide-ink-700">
        {TABS.map((t) => {
          const selected = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setInput("");
              }}
              className={`relative py-3 text-[11px] tracking-widest uppercase transition-colors ${
                selected
                  ? "bg-flame-400 text-ink-950"
                  : "text-ink-400 hover:text-ink-50 hover:bg-ink-900"
              }`}
            >
              {t.label}
              {selected && (
                <span className="absolute left-0 right-0 -bottom-px h-px bg-flame-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Input + meta */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">{active.label} amount</span>
          <button
            type="button"
            onClick={() => setInput(fmt(max, 18, 6).replace(/,/g, ""))}
            className="eyebrow text-flame-400 hover:text-ink-50 transition-colors"
          >
            Max · {fmt(max, 18, tab === "withdraw" || tab === "deposit" ? 4 : 2)} {active.unit}
          </button>
        </div>

        <div className="flex items-stretch border border-ink-700 focus-within:border-flame-400 transition-colors">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!contracts || busy}
            className="flex-1 bg-transparent px-4 py-4 figure text-2xl text-ink-50 placeholder-ink-500 focus:outline-none disabled:opacity-40"
          />
          <div className="flex items-center px-4 border-l border-ink-700 eyebrow text-ink-100">
            {active.unit}
          </div>
        </div>

        {/* Contextual hint */}
        <ContextHint tab={tab} data={data} amount={parse(input, 18)} />
      </div>

      <button
        onClick={submit}
        disabled={!contracts || busy || !input}
        className="w-full border border-flame-400 bg-flame-400 text-ink-950 py-4 text-xs tracking-widest uppercase font-bold hover:bg-flame-500 hover:border-flame-500 disabled:bg-ink-900 disabled:border-ink-700 disabled:text-ink-500 transition-colors"
      >
        {busy ? "Confirming…" : `Execute ${active.label}`}
      </button>

      {tab === "repay" && data.mUSDBalance < data.debtUSD && data.debtUSD > 0n && (
        <p className="text-xs text-ink-400 leading-relaxed">
          <span className="text-flame-400">Note —</span> your wallet only holds{" "}
          {fmtUSD(data.mUSDBalance)} mUSD against {fmtUSD(data.debtUSD)} mUSD of debt.
          Acquire more mUSD before you can fully repay.
        </p>
      )}
    </section>
  );
}

function ContextHint({
  tab,
  data,
  amount,
}: {
  tab: ActionKey;
  data: VaultData;
  amount: bigint;
}) {
  if (amount === 0n) return null;

  if (tab === "deposit" && data.ethPriceUSD > 0n) {
    const usd = (amount * data.ethPriceUSD) / 10n ** 18n;
    return (
      <p className="text-xs text-ink-400 figure">
        ≈ ${fmtUSD(usd)} of new collateral
      </p>
    );
  }
  if (tab === "mint") {
    return (
      <p className="text-xs text-ink-400 figure">
        New debt total: {fmtUSD(data.debtUSD + amount)} mUSD
      </p>
    );
  }
  if (tab === "repay") {
    const after = data.debtUSD > amount ? data.debtUSD - amount : 0n;
    return (
      <p className="text-xs text-ink-400 figure">
        Debt after repay: {fmtUSD(after)} mUSD
      </p>
    );
  }
  if (tab === "withdraw") {
    const after = data.collateralETH > amount ? data.collateralETH - amount : 0n;
    return (
      <p className="text-xs text-ink-400 figure">
        Collateral after withdraw: {fmt(after, 18, 4)} ETH
      </p>
    );
  }
  return null;
}

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("user rejected") || m.includes("user denied"))
    return "Transaction rejected in wallet.";
  if (m.includes("undercollateralized"))
    return "Position would become undercollateralized — try a smaller amount.";
  if (m.includes("insufficientcollateral"))
    return "Withdrawal exceeds deposited collateral.";
  if (m.includes("circuitbreakertripped"))
    return "Oracle circuit breaker is tripped — minting paused.";
  if (m.includes("staleprice")) return "Chainlink price is stale — try again later.";
  if (m.includes("invalidprice")) return "Chainlink returned an invalid price.";
  if (m.includes("repay exceeds debt"))
    return "Repay amount exceeds outstanding debt.";
  if (m.includes("erc20insufficientbalance"))
    return "Not enough mUSD in your wallet.";
  if (m.includes("insufficient funds"))
    return "Wallet has insufficient ETH for value + gas.";
  return msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
}
