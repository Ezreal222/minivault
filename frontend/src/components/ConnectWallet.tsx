import { shortAddr } from "../lib/format";

interface Props {
  installed: boolean;
  account: string | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  onConnect: () => void;
  onSwitch: () => void;
}

export function ConnectWallet(props: Props) {
  const { installed, account, isConnected, isCorrectChain, onConnect, onSwitch } = props;

  if (!installed) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="border border-rust-400 text-rust-400 px-4 py-2 text-xs tracking-widest uppercase hover:bg-rust-400 hover:text-ink-950 transition-colors"
      >
        Install MetaMask ↗
      </a>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={onConnect}
        className="group flex items-center gap-3 border border-flame-400 text-flame-400 px-4 py-2 text-xs tracking-widest uppercase hover:bg-flame-400 hover:text-ink-950 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-flame-400 group-hover:bg-ink-950 animate-blink" />
        Connect Wallet
      </button>
    );
  }

  if (!isCorrectChain) {
    return (
      <button
        onClick={onSwitch}
        className="flex items-center gap-3 border border-rust-400 text-rust-400 px-4 py-2 text-xs tracking-widest uppercase hover:bg-rust-400 hover:text-ink-950 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rust-400 animate-blink" />
        Switch to Sepolia
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 border border-ink-700 px-4 py-2 text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-moss-400 shadow-[0_0_8px_rgba(61,214,140,0.6)]" />
      <span className="eyebrow text-ink-400">Sepolia</span>
      <span className="text-ink-500">/</span>
      <span className="font-mono text-ink-50 tracking-tight">{shortAddr(account!)}</span>
    </div>
  );
}
