import { afterEach, describe, expect, it, vi } from 'vitest';
import { alternateGateway, fetchVerifiedTokens, safeUrl, verifiedLinks } from './cookieswap';

describe('safeUrl', () => {
  it('keeps ordinary web links', () => {
    expect(safeUrl('https://x.com/CookieInumeme')).toBe('https://x.com/CookieInumeme');
    expect(safeUrl('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
  });

  it('drops script and document schemes', () => {
    // These are the two that matter: javascript: in an href executes, and
    // data: can carry a whole document. Both arrive from a third party.
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeUrl('vbscript:msgbox(1)')).toBeNull();
    expect(safeUrl('file:///etc/passwd')).toBeNull();
  });

  it('drops empty and unparseable values', () => {
    expect(safeUrl(undefined)).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('   ')).toBeNull();
    expect(safeUrl('not a url')).toBeNull();
  });
});

describe('verifiedLinks', () => {
  it('orders the socials worth showing and skips the ones that are missing', () => {
    const links = verifiedLinks({
      tokenMint: 'm',
      x: 'https://x.com/a',
      website: 'https://a.example',
      discord: 'https://discord.gg/a',
    });
    expect(links.map((l) => l.label)).toEqual(['X', 'website', 'discord']);
  });

  it('drops an unsafe link instead of passing it through', () => {
    const links = verifiedLinks({ tokenMint: 'm', x: 'javascript:alert(1)', telegram: 'https://t.me/a' });
    expect(links.map((l) => l.label)).toEqual(['telegram']);
  });
});

describe('alternateGateway', () => {
  it('moves an IPFS logo onto a different gateway', () => {
    const out = alternateGateway('https://ipfs.io/ipfs/Qmabc/logo.png');
    expect(out).not.toContain('ipfs.io');
    expect(out).toContain('/ipfs/Qmabc/logo.png');
  });

  it('does not loop back to the same host', () => {
    const once = alternateGateway('https://ipfs.io/ipfs/Qmabc');
    expect(alternateGateway(once)).not.toBe(once);
  });

  it('leaves non-IPFS urls alone', () => {
    expect(alternateGateway('https://example.com/logo.png')).toBe('https://example.com/logo.png');
  });

  it('leaves an unparseable url alone rather than throwing', () => {
    expect(alternateGateway('nonsense')).toBe('nonsense');
  });
});

describe('fetchVerifiedTokens', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keys records by mint and sanitises the image urls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          tokens: [
            { tokenMint: 'mint-a', symbol: 'A', logoUrl: 'https://gateway.pinata.cloud/ipfs/x' },
            { tokenMint: 'mint-b', symbol: 'B', logoUrl: 'javascript:alert(1)' },
          ],
        }),
      })),
    );
    const map = await fetchVerifiedTokens();
    expect([...map.keys()]).toEqual(['mint-a', 'mint-b']);
    expect(map.get('mint-a')?.logoUrl).toContain('gateway.pinata.cloud');
    expect(map.get('mint-b')?.logoUrl).toBeNull();
  });

  it('throws when the endpoint fails, so the caller can decide', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(fetchVerifiedTokens()).rejects.toThrow(/503/);
  });

  it('returns an empty map for a registry with nothing in it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tokens: [] }) })));
    await expect(fetchVerifiedTokens()).resolves.toEqual(new Map());
  });

  it('skips records with no mint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ tokens: [{ symbol: 'X' }, { tokenMint: 'ok' }] }) })),
    );
    const map = await fetchVerifiedTokens();
    expect([...map.keys()]).toEqual(['ok']);
  });
});
