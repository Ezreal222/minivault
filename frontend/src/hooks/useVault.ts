import { useCallback, useEffect, useMemo, useState } from "react";
import type { BrowserProvider, JsonRpcSigner } from "ethers";
import { makeContracts, type Contracts } from "../lib/contracts";

export interface VaultData {
  ethPriceUSD: bigint;       // 18-decimal scaled
  collateralETH: bigint;     // wei
  debtUSD: bigint;           // 18-dec mUSD
  healthFactor: bigint;      // percent (uint)
  mUSDBalance: bigint;       // 18-dec
  ethBalance: bigint;        // wei
  vaultTripped: boolean;     // circuit breaker state
  loading: boolean;
  lastUpdated: number;
}

const EMPTY: VaultData = {
  ethPriceUSD: 0n,
  collateralETH: 0n,
  debtUSD: 0n,
  healthFactor: 0n,
  mUSDBalance: 0n,
  ethBalance: 0n,
  vaultTripped: false,
  loading: false,
  lastUpdated: 0,
};

export function useVault(
  provider: BrowserProvider | null,
  signer: JsonRpcSigner | null,
  account: string | null,
  isCorrectChain: boolean,
) {
  const [data, setData] = useState<VaultData>(EMPTY);
  const [tick, setTick] = useState(0);

  const readContracts = useMemo<Contracts | null>(() => {
    if (!provider || !isCorrectChain) return null;
    return makeContracts(provider);
  }, [provider, isCorrectChain]);

  const writeContracts = useMemo<Contracts | null>(() => {
    if (!signer || !isCorrectChain) return null;
    return makeContracts(signer);
  }, [signer, isCorrectChain]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Refresh whenever account / chain / explicit tick changes
  useEffect(() => {
    if (!readContracts || !account || !provider) {
      setData(EMPTY);
      return;
    }
    let cancelled = false;
    setData((d) => ({ ...d, loading: true }));

    (async () => {
      try {
        const [price, position, hf, mUSDBal, ethBal, tripped] =
          await Promise.all([
            readContracts.oracle.peekPriceUSD(),
            readContracts.vault.positions(account),
            readContracts.vault.healthFactor(account),
            readContracts.miniUSD.balanceOf(account),
            provider.getBalance(account),
            readContracts.oracle.tripped(),
          ]);

        if (cancelled) return;
        setData({
          ethPriceUSD: price,
          collateralETH: position[0],
          debtUSD: position[1],
          healthFactor: hf,
          mUSDBalance: mUSDBal,
          ethBalance: ethBal,
          vaultTripped: tripped,
          loading: false,
          lastUpdated: Date.now(),
        });
      } catch (err) {
        if (cancelled) return;
        console.error("vault read failed", err);
        setData((d) => ({ ...d, loading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readContracts, account, provider, tick]);

  // Auto-poll the price every 20s for the ticker
  useEffect(() => {
    if (!readContracts) return;
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [readContracts, refresh]);

  return { data, refresh, writeContracts };
}
