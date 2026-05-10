import { useEffect, useState } from "react";
import { useWallet } from "./hooks/useWallet";
import { useVault } from "./hooks/useVault";
import { ConnectWallet } from "./components/ConnectWallet";
import { PriceTicker } from "./components/PriceTicker";
import { HealthFactor } from "./components/HealthFactor";
import { ActionPanel, type BannerState } from "./components/ActionPanel";
import { LiquidatePanel } from "./components/LiquidatePanel";
import { Banner } from "./components/Banner";
import { ADDRESSES } from "./lib/contracts";

function serial() {
  // a fake "bond serial" for typographic flavor — purely cosmetic
  const day = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .slice(0, 8);
  return `MV-${day}-${(Math.random() * 0xffff | 0).toString(16).toUpperCase().padStart(4, "0")}`;
}

export default function App() {
  const wallet = useWallet();
  const { data, refresh, writeContracts } = useVault(
    wallet.provider,
    wallet.signer,
    wallet.account,
    wallet.isCorrectChain,
  );

  const [banner, setBanner] = useState<BannerState | null>(null);
  const [docSerial] = useState(serial);

  // Auto-dismiss success banners after 7s
  useEffect(() => {
    if (banner?.kind === "success") {
      const t = setTimeout(() => setBanner(null), 7000);
      return () => clearTimeout(t);
    }
  }, [banner]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* TOP NAV STRIP */}
      <header className="border-b border-ink-700">
        <div className="max-w-[640px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="serif-italic text-2xl text-flame-400 leading-none">M</div>
            <span className="eyebrow text-ink-400">MiniVault</span>
            <span className="hidden sm:inline text-ink-700">·</span>
            <span className="hidden sm:inline eyebrow text-ink-500">CDP v0.1</span>
          </div>
          <ConnectWallet
            installed={wallet.installed}
            account={wallet.account}
            isConnected={wallet.isConnected}
            isCorrectChain={wallet.isCorrectChain}
            onConnect={wallet.connect}
            onSwitch={wallet.switchToSepolia}
          />
        </div>
      </header>

      {/* MAIN COLUMN */}
      <main className="flex-1 max-w-[640px] w-full mx-auto px-6 py-12 space-y-14">
        {/* HERO — bold serif wordmark */}
        <section className="space-y-6 animate-fade-up">
          <div className="flex items-start justify-between text-[10px] tracking-widest uppercase text-ink-500">
            <span>SERIAL · {docSerial}</span>
            <span className="text-right">SEPOLIA TESTNET<br />CHAINLINK GUARDED</span>
          </div>

          <h1 className="serif-display text-[120px] sm:text-[160px] text-ink-50 leading-[0.85]">
            Mini<br/><span className="serif-italic text-flame-400">Vault</span>
          </h1>

          <div className="flex items-start gap-4 pt-2">
            <span className="hidden sm:block w-10 h-px bg-ink-700 mt-3" />
            <p className="text-sm text-ink-100 leading-relaxed flex-1">
              A crypto-collateralized stablecoin with a{" "}
              <span className="text-flame-400">same-block oracle circuit breaker</span>.
              Lock ETH, mint mUSD up to 150% collateralization, and exit at will —
              defended against flash-loan price manipulation in the Mango Markets style.
            </p>
          </div>
        </section>

        <div className="hairline" />

        {/* LIVE TICKER */}
        <section className="animate-fade-up [animation-delay:120ms]">
          <PriceTicker price={data.ethPriceUSD} tripped={data.vaultTripped} />
          {data.vaultTripped && (
            <div className="mt-4 border border-rust-400 p-4 text-xs text-rust-400">
              <p className="eyebrow text-rust-400 mb-2">CIRCUIT BREAKER TRIPPED</p>
              <p className="leading-relaxed">
                The oracle observed a {">"}5% price move within a single block.
                Minting is paused until the breaker is cleared.
              </p>
            </div>
          )}
        </section>

        {/* CONNECTION GATE */}
        {!wallet.installed && (
          <Notice title="Wallet not detected">
            Install MetaMask or another EIP-1193 wallet to interact with the vault.
          </Notice>
        )}

        {wallet.installed && !wallet.isConnected && (
          <Notice title="Connect wallet">
            Tap <em className="not-italic text-flame-400">Connect Wallet</em> in
            the header to view your position and execute transactions on Sepolia.
          </Notice>
        )}

        {wallet.installed && wallet.isConnected && !wallet.isCorrectChain && (
          <Notice title="Wrong network" tone="danger">
            MiniVault is deployed on <span className="text-ink-50">Sepolia</span>.
            Switch networks via the prompt in the header.
          </Notice>
        )}

        {wallet.installed && wallet.isConnected && wallet.isCorrectChain && (
          <>
            <HealthFactor data={data} />

            <ActionPanel
              contracts={writeContracts}
              data={data}
              onAction={refresh}
              setBanner={setBanner}
            />

            <LiquidatePanel
              contracts={writeContracts}
              ownData={data}
              setBanner={setBanner}
              onAction={refresh}
            />
          </>
        )}
      </main>

      {/* FOOTER — bond-certificate style */}
      <footer className="border-t border-ink-700 mt-12">
        <div className="max-w-[640px] mx-auto px-6 py-6 grid grid-cols-3 gap-6 text-[10px] tracking-widest uppercase text-ink-500">
          <div className="space-y-1.5">
            <p className="text-flame-400">Vault</p>
            <a
              href={`https://sepolia.etherscan.io/address/${ADDRESSES.Vault}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono normal-case tracking-tight text-ink-100 hover:text-flame-400 transition-colors break-all"
            >
              {ADDRESSES.Vault.slice(0, 6)}…{ADDRESSES.Vault.slice(-4)}
            </a>
          </div>
          <div className="space-y-1.5">
            <p className="text-flame-400">mUSD</p>
            <a
              href={`https://sepolia.etherscan.io/address/${ADDRESSES.MiniUSD}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono normal-case tracking-tight text-ink-100 hover:text-flame-400 transition-colors break-all"
            >
              {ADDRESSES.MiniUSD.slice(0, 6)}…{ADDRESSES.MiniUSD.slice(-4)}
            </a>
          </div>
          <div className="space-y-1.5">
            <p className="text-flame-400">Oracle</p>
            <a
              href={`https://sepolia.etherscan.io/address/${ADDRESSES.OracleAdapter}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono normal-case tracking-tight text-ink-100 hover:text-flame-400 transition-colors break-all"
            >
              {ADDRESSES.OracleAdapter.slice(0, 6)}…{ADDRESSES.OracleAdapter.slice(-4)}
            </a>
          </div>
        </div>
        <div className="hairline-solid" />
        <div className="max-w-[640px] mx-auto px-6 py-4 flex items-center justify-between text-[10px] tracking-widest uppercase text-ink-500">
          <span>NYU TANDON · CS-GY 9223 D</span>
          <span>NOT FINANCIAL ADVICE — TESTNET ONLY</span>
        </div>
      </footer>

      <Banner banner={banner} onDismiss={() => setBanner(null)} />
    </div>
  );
}

function Notice({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "info" | "danger";
}) {
  const ring = tone === "danger" ? "border-rust-400" : "border-ink-700";
  const accent = tone === "danger" ? "text-rust-400" : "text-flame-400";
  return (
    <div className={`border ${ring} p-6 space-y-2 animate-fade-up [animation-delay:240ms]`}>
      <p className={`eyebrow ${accent}`}>{title}</p>
      <p className="text-sm text-ink-100 leading-relaxed">{children}</p>
    </div>
  );
}
