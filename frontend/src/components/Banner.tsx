import type { BannerState } from "./ActionPanel";

interface Props {
  banner: BannerState | null;
  onDismiss: () => void;
}

export function Banner({ banner, onDismiss }: Props) {
  if (!banner) return null;

  const styles = {
    info: { ring: "border-ink-700", text: "text-ink-100", dot: "bg-ink-400" },
    pending: {
      ring: "border-flame-400",
      text: "text-flame-400",
      dot: "bg-flame-400 animate-blink",
    },
    success: { ring: "border-moss-400", text: "text-moss-400", dot: "bg-moss-400" },
    error: { ring: "border-rust-400", text: "text-rust-400", dot: "bg-rust-400" },
  }[banner.kind];

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 border ${styles.ring} bg-ink-950/95 backdrop-blur max-w-[640px] w-[calc(100%-2rem)] animate-fade-in`}
    >
      <span className={`w-2 h-2 rounded-full ${styles.dot} flex-shrink-0`} />
      <div className="flex-1 text-xs">
        <p className={`${styles.text} leading-relaxed`}>{banner.text}</p>
        {banner.hash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${banner.hash}`}
            target="_blank"
            rel="noreferrer"
            className="eyebrow text-ink-400 hover:text-flame-400 transition-colors mt-1 inline-block"
          >
            view on etherscan ↗
          </a>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-ink-500 hover:text-ink-100 text-lg leading-none"
        aria-label="dismiss"
      >
        ×
      </button>
    </div>
  );
}
