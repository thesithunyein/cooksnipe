<p align="center">
  <img src="public/cooksnipe.png" width="160" alt="CookSnipe logo" />
</p>

<h1 align="center">CookSnipe</h1>

<p align="center">
  Live launch radar for the <a href="https://momoswap.fun">MomoSwap</a> launchpad on
  <a href="https://www.cookiescan.io">Cookie Chain</a> (Solana VM).
</p>

<p align="center">
  <a href="https://cooksnipe.sithunyein.com">Live site</a> ·
  <a href="https://cooksnipe.sithunyein.com/#/app">Open the app</a>
</p>

---

## What it does

CookSnipe watches the MomoSwap launchpad in real time so you don't have to refresh an explorer:

- **Launch radar** — every live launch with price, COOK raised, buyers, and bonding-curve graduation progress. New launches flash as they appear.
- **Token detail** — live price chart, bonding-curve visual with a "you are here" marker, safety checks (anti-snipe, migratable, expiry mode), and a simulated buy quote using the chain's real fee schedule.
- **Portfolio** — paste any wallet address and see its launchpad positions valued in COOK at current curve prices, with PnL.
- **Demo mode** — clearly badged simulated feed, so the app is explorable even when the chain is quiet.

Everything is **read-only** — no wallet connection, no transactions yet. Wallet-connected sniping is the next milestone.

## How it works

- Polls the public MomoSwap launchpad API (`api.momoswap.fun/v1/launchpad`) through a same-origin `/api` proxy (the API sends no CORS headers). Configurable poll interval, 3–30s.
- Bonding-curve math is a BigInt constant-product implementation that mirrors the on-chain program's rounding (ported from the MIT-licensed `cookiechain/cookie-mcp` reference).
- When the active-launch list is empty, that's the real state of the chain — the app says so instead of faking activity.

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · lightweight-charts

## Develop

```bash
npm install
npm run dev      # http://localhost:5173  (#/app for the radar)
npm run build    # typecheck + production build
```

Deployed on Vercel at [cooksnipe.sithunyein.com](https://cooksnipe.sithunyein.com).
