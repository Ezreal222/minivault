import { fmt } from "../lib/format";

interface Props {
  price: bigint;
  tripped: boolean;
}

export function PriceTicker({ price, tripped }: Props) {
  const priceStr = price > 0n ? fmt(price, 18, 2) : "—";

  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-3">
        <span className="eyebrow">ETH/USD</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            tripped
              ? "bg-rust-400 animate-blink shadow-[0_0_8px_rgba(255,90,77,0.6)]"
              : "bg-flame-400 animate-blink shadow-[0_0_8px_rgba(255,178,0,0.6)]"
          }`}
        />
        <span className="font-mono text-ink-50 figure tracking-tight">
          ${priceStr}
        </span>
      </div>
      <div className="flex items-center gap-2 text-ink-400">
        <span className="eyebrow">CHAINLINK · SEPOLIA</span>
      </div>
    </div>
  );
}
