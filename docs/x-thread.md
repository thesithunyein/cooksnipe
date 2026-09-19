# X thread — CookSnipe submission

Posting notes: post as one thread, banner as image on 1/, claim-center
screenshot on 4/, radar on 2/, trade panel on 3/. After posting, drop the
thread URL in the Cookie Chain Telegram (General), then fill `links.x` and
`links.video` in the catalogue PR (#26) and the Earn submission.

---

**1/ Hook** — Cookie Chain launches live and die in a week — and the
launchpad never tells you what it still owes you. So we built CookSnipe: a
radar, curve trading, and a claim center that scans every pool for money a
wallet is owed. 🧵

**2/** The radar watches every MomoSwap launch live — price, raised, buyers,
graduation progress, anti-snipe flags. No more F5 on the launchpad.

**3/** Buy and sell on the bonding curve with Nightly. Every transaction is
built unsigned, verified byte-for-byte (fee payer, program ids, instruction
data), simulated — and only then broadcast over the Cookie Chain RPC. Why?
Wallets broadcast via their own RPC, which on a custom SVM chain points at
Solana mainnet, and your tx silently never lands.

**4/** The claim center is the part nothing else does. Paste any address —
it walks every pool asking: is this wallet owed anything? Refunds from
expired fair-mode pools. Settlement payouts. Graduated tokens. Creator
fees. In testing it found a real **10,022 COOK refund** sitting on a live
address.

**5/** How to use it (1 minute): ① open cooksnipe.sithunyein.com/app
② connect Nightly ③ watch the radar, click a pool, trade the curve ④ check
the Claims tab — you might be owed money right now.

**6/** New to Cookie Chain? Get COOK via the official bridge — instant, 1:1,
Hyperlane: ① go to hyperlane.cookiescan.io ② connect your Solana wallet
③ bridge COOK over ④ point Nightly at the Cookie Chain RPC:
rpc.cookiescan.io. Only use bridges linked from official community channels.

**7/** CookSnipe is open source, MIT. App: cooksnipe.sithunyein.com/app ·
Code: github.com/thesithunyein/cooksnipe · Built on MomoSwap's launchpad
program, Cookiebox and Cookie DAS. Run the claim scan on your own address
before you go — you might already be owed something.
