// Cookiescan DAS API + price feed (api.cookiescan.io).
//
// This is Cookie Chain's own indexer, and it is the only place that can answer
// "what does this wallet actually hold" — the wallet itself shows nothing for
// these assets. It sends permissive CORS headers, so the browser calls it direct.
const DAS = 'https://api.cookiescan.io';

export interface WalletAsset {
  mint: string;
  name: string;
  symbol: string;
  balance: number;
  decimals: number;
  /** DAS interface, e.g. 'FungibleToken' | 'VentedNFT'. */
  iface: string;
  image?: string;
}

interface DasItem {
  id?: string;
  interface?: string;
  content?: { metadata?: { name?: string; symbol?: string }; links?: { image?: string } };
  token_info?: { balance?: number; decimals?: number; symbol?: string };
}

/** Fungible assets only — an NFT with an amount of 1 is not a token balance. */
const isFungible = (item: DasItem) => {
  const iface = item.interface ?? '';
  return iface === 'FungibleToken' || iface === 'FungibleAsset' || (iface === '' && item.token_info !== undefined);
};

/**
 * Every SPL / Token-2022 asset a wallet holds, per the DAS index.
 * Returns [] rather than throwing: a missing index should never break the page.
 */
export async function getWalletAssets(owner: string, limit = 100): Promise<WalletAsset[]> {
  try {
    const res = await fetch(DAS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'cooksnipe-assets',
        method: 'getAssetsByOwner',
        params: { ownerAddress: owner, page: 1, limit },
      }),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { result?: { items?: DasItem[] } };
    return (body.result?.items ?? [])
      .filter(isFungible)
      .map((item) => ({
        mint: item.id ?? '',
        name: item.content?.metadata?.name ?? item.token_info?.symbol ?? 'Unknown',
        symbol: item.content?.metadata?.symbol ?? item.token_info?.symbol ?? '???',
        balance: Number(item.token_info?.balance ?? 0),
        decimals: Number(item.token_info?.decimals ?? 0),
        iface: item.interface ?? '',
        image: item.content?.links?.image,
      }))
      .filter((a) => a.mint && a.balance > 0);
  } catch {
    return [];
  }
}

let priceCache: { at: number; usd: number } | null = null;

/** COOK in USD, cached for a minute. Null when the feed is unavailable. */
export async function cookPriceUsd(): Promise<number | null> {
  if (priceCache && Date.now() - priceCache.at < 60_000) return priceCache.usd;
  try {
    const res = await fetch(`${DAS}/api/price/cook`);
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { price?: { usd?: number } } };
    const usd = body.data?.price?.usd;
    if (typeof usd === 'number' && usd > 0) {
      priceCache = { at: Date.now(), usd };
      return usd;
    }
    return null;
  } catch {
    return null;
  }
}

export const cookiescanTokenUrl = (mint: string) => `https://cookiescan.io/token/${mint}`;
