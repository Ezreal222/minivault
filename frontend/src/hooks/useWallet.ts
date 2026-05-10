import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { SEPOLIA_CHAIN_ID, SEPOLIA_HEX, SEPOLIA_PARAMS } from "../lib/contracts";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface WalletState {
  account: string | null;
  chainId: number | null;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  installed: boolean;
}

export function useWallet() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [error, setError] = useState<string | null>(null);

  const installed = typeof window !== "undefined" && !!window.ethereum;

  const refreshSigner = useCallback(async (p: BrowserProvider) => {
    try {
      const s = await p.getSigner();
      const addr = await s.getAddress();
      const net = await p.getNetwork();
      setSigner(s);
      setAccount(addr);
      setChainId(Number(net.chainId));
    } catch {
      setSigner(null);
      setAccount(null);
    }
  }, []);

  // Eagerly read wallet state on mount IF already connected.
  useEffect(() => {
    if (!installed) return;
    const p = new BrowserProvider(window.ethereum, "any");
    setProvider(p);

    (async () => {
      const accounts: string[] = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts.length > 0) {
        await refreshSigner(p);
      } else {
        const net = await p.getNetwork();
        setChainId(Number(net.chainId));
      }
    })();

    const onAccounts = (accs: string[]) => {
      if (accs.length === 0) {
        setAccount(null);
        setSigner(null);
      } else {
        refreshSigner(p);
      }
    };
    const onChain = (_cid: string) => {
      // hard reload is the safest thing per MetaMask docs
      window.location.reload();
    };
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);

    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [installed, refreshSigner]);

  const connect = useCallback(async () => {
    setError(null);
    if (!installed) {
      setError("No wallet detected. Install MetaMask.");
      return;
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const p = provider ?? new BrowserProvider(window.ethereum, "any");
      if (!provider) setProvider(p);
      await refreshSigner(p);
    } catch (e: any) {
      setError(e?.message ?? "Failed to connect");
    }
  }, [installed, provider, refreshSigner]);

  const switchToSepolia = useCallback(async () => {
    if (!installed) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_HEX }],
      });
    } catch (e: any) {
      // 4902 = chain not added
      if (e?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [SEPOLIA_PARAMS],
        });
      } else {
        setError(e?.message ?? "Failed to switch network");
      }
    }
  }, [installed]);

  const isConnected = !!account && !!signer;
  const isCorrectChain = chainId === SEPOLIA_CHAIN_ID;

  const state = useMemo<WalletState>(
    () => ({
      account,
      chainId,
      provider,
      signer,
      isConnected,
      isCorrectChain,
      installed,
    }),
    [account, chainId, provider, signer, isConnected, isCorrectChain, installed],
  );

  return { ...state, connect, switchToSepolia, error };
}
