# Stake Belt

Quadratic polls on Stellar Testnet, where small voters can outweigh whales.

Stake Belt runs stake-weighted polls on Soroban with quadratic vote math, so doubling your stake gives you only about 1.41x more voice. Stakes lock for the voting window, anyone can finalize once the deadline passes, and voters auto-release their own stake on chain.

[![CI](https://github.com/NMKhang001/03-poll/actions/workflows/ci.yml/badge.svg)](https://github.com/NMKhang001/03-poll/actions/workflows/ci.yml)
![Stellar Testnet](https://img.shields.io/badge/Stellar-Testnet-7B3FFA)
[Live Demo](https://stake-belt.vercel.app)

## What You Get

- **Quadratic voting on chain.** Vote weight is the integer square root of staked stroops. The contract enforces it; no off-chain math.
- **Live tally bars.** Each option's percentage and voter count refresh every 12 seconds from on-chain state.
- **Auto-release stakes.** Once the deadline passes anyone can finalize. After that, each voter releases their own stake with a single signed call.
- **Multi-wallet support.** Freighter, xBull, Albedo, and Lobstr all work via Stellar Wallets Kit.
- **Real-time event feed.** Soroban RPC `getEvents` polling decodes `created`, `vote`, `final`, and `release` topics into a single stream.

## See It

- Live demo: https://stake-belt.vercel.app
- Demo video: https://youtu.be/REPLACE_ME
- Main contract on Stellar Expert: https://stellar.expert/explorer/testnet/contract/CCKCNLTNPRBQAU564NTTQTPYGJNBYUAB33H6X7D2TL2W5LPFYLXIHWDK
- Native XLM SAC: https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC (testnet built-in)

## How It Works

For voters, the flow is short. You connect a wallet, scan the open polls, pick an option, and stake some XLM. The contract records your stake, hashes it down to a quadratic weight, and updates the option's running tally. When the timer ends the poll auto-releases, you sign one more call, and your stake comes back as a public on-chain receipt.

For developers, the contract is one Soroban crate at `contract/main`. State lives in four `DataKey` variants: `PollCount`, `Poll(id)`, `Tally(poll_id, option_idx)`, and `Vote(poll_id, voter)`. The `cast_vote` method computes `isqrt(stake)` in `no_std` Rust, persists per-voter and per-option state, and emits a `vote` topic event. `finalize` walks the option tallies and picks the largest `weight_sum`. The frontend reads tallies via `simulateTransaction` and watches events via `getEvents` polling.

Why on chain? Quadratic voting only works if the math and the stakes are both auditable. Anyone reading the contract can verify the weight curve, the deadline, and every individual vote. There is no admin who can edit a tally or end voting early.

## Run It

```bash
cp .env.example .env.local                # fill the contract id after deploy
npm install
stellar keys generate alice --network testnet --fund   # one-time
./scripts/deploy.sh alice                 # deploys, writes contract id to .env.local
npm run dev                               # http://localhost:3002
```

## CI / CD

`.github/workflows/ci.yml` runs typecheck + build on the frontend and `cargo test` on the contract for every push and PR. The frontend ships to Vercel automatically on push to `main` thanks to `vercel.json`. Contract deploys are manual through `scripts/deploy.sh` so a Stellar signing key never sits in a GitHub secret. Full procedure in [`docs/deployment.md`](./docs/deployment.md).

## Stack

- Next.js 15 App Router, React 19, TypeScript strict
- Tailwind v4 with `@theme` design tokens
- @stellar/stellar-sdk for Horizon and Soroban RPC
- @creit.tech/stellar-wallets-kit (Freighter, xBull, Albedo, Lobstr)
- @tanstack/react-query for caching and polling
- soroban-sdk 22 for the contract, Stellar CLI 25 for build and deploy

## Tests

6 cargo tests on the poll contract, run via `cargo test` in `contract/`.

<details>
<summary>Test list</summary>

- `create_then_vote_records_quadratic_weight`
- `multiple_votes_accumulate_per_option`
- `cannot_vote_twice_in_same_poll`
- `finalize_picks_highest_quadratic_weight`
- `release_stake_only_after_finalize`
- `vote_after_deadline_fails`

</details>

## Screenshots

| Desktop | Mobile |
|---------|--------|
| ![desktop](docs/desktop.png) | ![mobile](docs/mobile.png) |

## Notes

- Stake amounts are in i128 stroops; the UI converts from XLM with 7 decimals.
- The contract caps options at 6 to keep the finalize loop short and tally storage cheap.
- Stakes really lock on chain. `cast_vote` pulls XLM into the contract via the native Stellar Asset Contract; `release_stake` pushes it back out after `finalize`. The Soroban host auto-authorizes the contract as `from` on the release transfer, so no extra auth dance is needed.
- Glassmorphism palette is intentional. The continuous tally fills read better against blurred translucent panels than against flat surfaces.
