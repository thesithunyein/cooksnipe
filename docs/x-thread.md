# X thread: CookSnipe submission

Posting notes: post as one thread. Images: banner on 1/, radar with the verified
chips on 2/, trade panel mid-transaction on 3/, claim center on 4/, the program
page on 5/. After posting, drop the thread URL in the Cookie Chain Telegram
(General), then fill `links.x` and `links.video` in the catalogue PR (#26) and
file the entry on Earn.

---

**1/ Hook** A launch on Cookie Chain lives and dies in about a week, and when it
is over the launchpad never tells you what it still owes you. So I built
CookSnipe: a live radar, curve trading, and a claim center that scans every pool
for money a wallet is owed. 🧵

**2/** The radar watches the MomoSwap launchpad live: price, raised, buyers,
graduation progress, anti-snipe flags. When the API cannot decode a pool it says
so on screen instead of hiding it. Tokens that CookieSwap's registry has vetted
get their real logo and a green verified chip, so a vetted project looks
different from a throwaway probe.

**3/** Buy and sell the bonding curve with Nightly. Every transaction is built
unsigned, verified byte-for-byte against the API's own description (fee payer,
program ids, instruction data, account order), simulated on Cookie Chain, and
only then broadcast. Why bother: a wallet broadcasts through its own RPC, which
by default still points at Solana mainnet, so the transaction silently never
lands. CookSnipe sends over the Cookie Chain RPC.

**4/** The claim center is the part nothing else does. Paste any address and it
walks every pool asking what that wallet is owed: refunds from expired fair-mode
pools, settlement payouts, graduated tokens, creator fees.

**5/** I also deployed a claim-log program to Cookie Chain for 0.227 COOK. It
writes claim records on chain, into an account the program owns, so a claim
result can be checked against something the app cannot rewrite:
AQnozqcJTp75LogCWQhCc4bKhgZChAqF9HHBLNNqun85

**6/** How to use it (1 minute): open cooksnipe.sithunyein.com/app, connect
Nightly, watch the radar, click a pool, trade the curve, then check the Claims
tab. You might be owed money right now.

**7/** New to the chain? COOK bridges over from Solana at
hyperlane.cookiescan.io. You sign once on the source chain and a relayer delivers
it 1:1 to your wallet, typically within a few minutes. Only use bridges linked
from official community channels.

**8/** CookSnipe is open source, MIT. App: cooksnipe.sithunyein.com/app · Code:
github.com/thesithunyein/cooksnipe · Built on MomoSwap's launchpad, Cookiebox,
Cookie DAS and CookieSwap's verified-token registry. Run the claim scan on your
own address before you go.
