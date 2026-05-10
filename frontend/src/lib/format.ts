import { formatUnits, parseUnits } from "ethers";

/** Truncate an address to 0xAB…CD */
export function shortAddr(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Format a bigint with `decimals` precision into a human string. */
export function fmt(value: bigint, decimals = 18, dp = 4): string {
  const raw = formatUnits(value, decimals);
  const [int, frac = ""] = raw.split(".");
  const trimmed = frac.slice(0, dp).replace(/0+$/, "");
  const intGrouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return trimmed ? `${intGrouped}.${trimmed}` : intGrouped;
}

/** Format USD with 2dp + thousands separators */
export function fmtUSD(value: bigint, decimals = 18): string {
  return fmt(value, decimals, 2);
}

/** Parse a user input string to wei/units. Tolerant of empty / dots. */
export function parse(input: string, decimals = 18): bigint {
  if (!input || input === "." || input === "-") return 0n;
  try {
    return parseUnits(input, decimals);
  } catch {
    return 0n;
  }
}

/** Compute a health-factor color tier from percent (uint). */
export type HealthTier = "safe" | "warn" | "danger" | "none";
export function healthTier(hfPercent: bigint): HealthTier {
  if (hfPercent === 0n) return "none";
  // contract returns type(uint256).max when no debt
  if (hfPercent > 1_000_000n) return "safe";
  if (hfPercent >= 200n) return "safe";
  if (hfPercent >= 150n) return "warn";
  return "danger";
}

export function tierColor(tier: HealthTier): string {
  switch (tier) {
    case "safe": return "text-moss-400";
    case "warn": return "text-flame-400";
    case "danger": return "text-rust-400";
    default: return "text-ink-400";
  }
}

export function tierLabel(tier: HealthTier): string {
  switch (tier) {
    case "safe": return "SAFE";
    case "warn": return "AT RISK";
    case "danger": return "LIQUIDATABLE";
    default: return "NO POSITION";
  }
}
