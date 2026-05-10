# MiniVault

A crypto-collateralized stablecoin system on the Ethereum Sepolia testnet,
built end-to-end as the final project for **CS-GY 9223 — Introduction to
Blockchain and Distributed Ledger Technology** (NYU Tandon, Spring 2026).

Lock ETH, mint a USD-pegged stablecoin (`mUSD`) up to a 150% collateralization
ratio, repay to unlock collateral, and get liquidated if the position goes
underwater. Backed by the live Chainlink ETH/USD price feed on Sepolia and
guarded by a custom **same-block oracle circuit breaker** that pauses minting
when a single block carries a >5% price move — the kind of move characteristic
of flash-loan oracle manipulation (cf. Mango Markets, Oct 2022).

---

## Deployed contracts (Sepolia)

| Contract        | Address                                      | Etherscan                                                                               |
| --------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `MiniUSD`       | `0x1EaE3d1aDE6b566B8A2a0Cd6857100D6a9eecdaf` | [view](https://sepolia.etherscan.io/address/0x1EaE3d1aDE6b566B8A2a0Cd6857100D6a9eecdaf) |
| `OracleAdapter` | `0x5C9f2C82E3De483dcc070a01b827001DCd3875cb` | [view](https://sepolia.etherscan.io/address/0x5C9f2C82E3De483dcc070a01b827001DCd3875cb) |
| `Vault`         | `0xD642bfff61872cC899594477A93d7cFEAE74CE6A` | [view](https://sepolia.etherscan.io/address/0xD642bfff61872cC899594477A93d7cFEAE74CE6A) |

All three are verified on Etherscan. Underlying Chainlink ETH/USD feed:
`0x694AA1769357215DE4FAC081bf1f309aDC325306`.

---

## Architecture

```
            ┌──────────────────────┐
            │  Chainlink ETH/USD   │
            │  (Sepolia, 8-dec)    │
            └──────────┬───────────┘
                       │ latestRoundData()
                       ▼
            ┌──────────────────────┐
            │   OracleAdapter      │   • scales 8-dec → 18-dec
            │   + circuit breaker  │   • staleness guard (1h)
            │                      │   • same-block >5% trip
            └──────────┬───────────┘
                       │ getPriceUSD()
                       ▼
   user ──ETH──▶ ┌──────────────────────┐ ──mint──▶ ┌─────────────┐
                 │        Vault          │           │  MiniUSD    │
   user ◀─ETH─── │  CDP core             │ ◀─burn─── │  ERC-20     │
                 │  • depositCollateral  │           │  vault-only │
                 │  • mintStablecoin     │           └─────────────┘
                 │  • repay              │
   liquidator ─▶ │  • withdrawCollateral │
                 │  • liquidate          │
                 └──────────────────────┘
```

Three contracts:

- **`MiniUSD.sol`** — ERC-20 stablecoin. Mint and burn are restricted to the
  Vault via a one-shot `setVault()` wiring step.
- **`OracleAdapter.sol`** — wraps Chainlink, normalizes to 18 decimals, rejects
  stale or non-positive prices, and trips a circuit breaker when two
  successful reads in the same block diverge by more than 5%.
- **`Vault.sol`** — the CDP core: deposit ETH, mint mUSD up to 150%
  collateralization, repay, withdraw, and liquidate underwater positions.

The Vault calls `oracle.getPriceUSD()` (state-changing, guarded) for every
solvency check and `oracle.peekPriceUSD()` (view-only) for the frontend's
health-factor display.

---

## Quickstart

### Prerequisites

- Node.js 20+ (the repo was developed against v23 with no issues; Hardhat
  emits a "not officially supported" warning that you can ignore)
- A funded Sepolia wallet (faucet:
  [cloud.google.com/.../faucet/ethereum/sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia))
- Alchemy / Infura RPC URL for Sepolia

### Install

```bash
git clone https://github.com/Ezreal222/minivault.git
cd minivault
npm install
cp .env.example .env   # fill in ALCHEMY_SEPOLIA_URL, PRIVATE_KEY, ETHERSCAN_API_KEY
```

### Compile and test

```bash
npx hardhat compile
npx hardhat test
```

The test suite covers all three contracts (33 cases) including the
same-block circuit breaker, liquidation under price drop, the 150%
collateralization boundary, and access-control on `MiniUSD`.

### Deploy (already deployed on Sepolia — re-run only to redeploy)

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

The script deploys all three contracts, calls `setVault()` to wire MiniUSD
to the Vault, verifies on Etherscan, and writes the addresses to
`frontend/src/lib/addresses.json`.

### Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, connect MetaMask on Sepolia, and walk the
flow: deposit ETH → mint mUSD → check health factor → repay → withdraw.
The UI exposes `liquidate(target)` under an "Advanced" panel that probes
the target's position before letting you submit.

---

## Project structure

```
minivault/
├── contracts/
│   ├── MiniUSD.sol
│   ├── OracleAdapter.sol
│   ├── Vault.sol
│   └── mocks/
│       ├── MockAggregator.sol      # deterministic price feed for tests
│       └── OracleTrigger.sol       # forces a same-tx, same-block trip
├── test/
│   ├── MiniUSD.test.ts
│   ├── OracleAdapter.test.ts
│   └── Vault.test.ts
├── scripts/
│   └── deploy.ts
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/             # ConnectWallet, HealthFactor,
│   │   │                           # ActionPanel (deposit/mint/repay/withdraw),
│   │   │                           # LiquidatePanel, PriceTicker, Banner
│   │   ├── hooks/                  # useWallet, useVault
│   │   ├── lib/                    # contracts.ts, addresses.json, format.ts
│   │   └── types/                  # TypeChain output (auto-generated)
│   ├── tailwind.config.js
│   └── vite.config.ts
├── paper/
│   └── MiniVault_Paper.pdf         # 2-page writeup
├── hardhat.config.ts
└── README.md
```

---

## Originality: same-block circuit breaker

The `OracleAdapter` keeps `(lastPrice, lastBlockSeen)` and, on every
`getPriceUSD()` call, compares the new Chainlink reading against the last one.
If the divergence exceeds **5% within the same block**, the call reverts with
`CircuitBreakerTripped` — preventing the Vault from minting against a
manipulated price.

This defends against the class of attack that drained $114M from Mango Markets
in October 2022, where flash-loan-driven oracle pumps allowed an attacker to
borrow against artificially inflated collateral within a single transaction.
Chainlink's own deviation thresholds protect the _feed_ update cadence;
this guard is at the _consumer_ boundary, where it can react to manipulation
in the same block it occurs.

Trade-offs and limitations are discussed in `paper/MiniVault_Paper.pdf` §3.

---

## Tech stack

| Layer      | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Contracts  | Solidity 0.8.24, OpenZeppelin ERC20, Hardhat               |
| Tests      | Hardhat + Mocha + Chai + ethers v6 + TypeChain             |
| Oracle     | Chainlink ETH/USD (Sepolia)                                |
| Frontend   | Vite + React 18 + TypeScript + Tailwind CSS v3 + ethers v6 |
| Deployment | Sepolia testnet, Etherscan-verified                        |

---

## Demo video

A 3–5 minute walkthrough of the full flow (deposit → mint → health factor →
liquidation, plus a tour of the circuit breaker in code) is available at:

> [YouTube unlisted link]

---

## Paper

A 2-page writeup grounded in MakerDAO, Liquity, and the Mango Markets
post-mortem lives at `paper/MiniVault_Paper.pdf`. References include:
Nakamoto (2008), Buterin et al. (2014), Maker Foundation (2020), Liquity AG
(2021), Klages-Mundt et al. (AFT 2020), Daian et al. (IEEE S&P 2020), and the
Mango DAO post-mortem (2022).

---

## Disclaimer

This is an academic project on a public testnet. **Do not use it for
anything resembling real value.** Known limitations (called out in the paper):
no stability fee, single-asset collateral, 100% collateral seizure on
liquidation, and no recovery mode for the circuit breaker once tripped.

---

## Author

**Yang Zheng** · NYU Tandon School of Engineering · May 2026
Course: CS-GY 9223 — Introduction to Blockchain and Distributed Ledger
Technology
