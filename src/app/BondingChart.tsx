// `lightweight-charts` is deliberately NOT imported here.
//
// This module holds the things the eager side needs: the `PricePoint` type and
// the SVG curve, which have no heavy dependencies. The live chart lives in
// LiveChart.tsx so TokenDetail can lazy-load the 3 MB chart library on the click
// that opens a pool, instead of every visitor downloading it for the radar.
// Importing that library here would silently put it back in the main chunk.

export interface PricePoint {
  time: number; // epoch seconds
  price: number; // COOK per token
}

/**
 * Static render of the pool's constant-product bonding curve: price (COOK/token)
 * as a function of % of the sale supply sold, with a dot at the current position.
 * price(s) = k / (y0 − s)², derived from the closed form of the curve math.
 */
export function CurveVisual({ pool }: { pool: { virtualPaymentReserve: string; virtualTokenReserve: string; tokensSold: string; saleTokenSupply: string } }) {
  const x0 = Number(pool.virtualPaymentReserve) / 1e9; // COOK UI
  const y0 = Number(pool.virtualTokenReserve) / 1e6; // token UI
  const saleSupply = Number(pool.saleTokenSupply) / 1e6;
  const sold = Math.min(Number(pool.tokensSold) / 1e6, saleSupply);
  if (!(x0 > 0 && y0 > 0 && saleSupply > 0)) {
    return <div className="text-[11px] text-[color:var(--ink-faint)]">Curve unavailable for this pool.</div>;
  }

  const k = x0 * y0;
  const priceAt = (s: number) => k / (y0 - s) ** 2;
  const pStart = priceAt(0);
  const pEnd = priceAt(saleSupply * 0.99);
  const logP = (p: number) => Math.log10(Math.max(p, pStart));
  const W = 320;
  const H = 120;
  const PAD = 8;
  const logMin = logP(pStart);
  const logMax = logP(pEnd);
  const xOf = (frac: number) => PAD + (W - PAD * 2) * frac;
  const yOf = (p: number) => H - PAD - (H - PAD * 2) * ((logP(p) - logMin) / (logMax - logMin || 1));

  const N = 48;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const frac = i / N;
    const s = saleSupply * frac;
    pts.push(`${xOf(frac).toFixed(1)},${yOf(priceAt(s)).toFixed(1)}`);
  }
  const soldFrac = Math.min(sold / saleSupply, 1);
  const curX = xOf(soldFrac);
  const curY = yOf(priceAt(sold));
  const soldPct = Math.min(100, (sold / saleSupply) * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="label">Bonding curve</span>
        <span className="text-[11px] text-[color:var(--ink-soft)] num">{soldPct.toFixed(1)}% sold</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="bonding curve">
        <defs>
          <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(13,12,11,0.13)" />
            <stop offset="100%" stopColor="rgba(13,12,11,0)" />
          </linearGradient>
        </defs>
        <path d={`M ${pts.join(' L ')} L ${xOf(1).toFixed(1)},${H} L ${xOf(0).toFixed(1)},${H} Z`} fill="url(#curveFill)" />
        <path d={`M ${pts.join(' L ')}`} fill="none" stroke="rgba(13,12,11,0.85)" strokeWidth="1.5" />
        <line x1={xOf(1)} y1={PAD} x2={xOf(1)} y2={H - PAD} stroke="rgba(13,12,11,0.18)" strokeDasharray="3 3" />
        <circle cx={curX} cy={curY} r="4" fill="#0d0c0b" />
        <circle cx={curX} cy={curY} r="7" fill="none" stroke="rgba(13,12,11,0.28)" />
      </svg>
      <div className="flex justify-between text-[10px] text-[color:var(--ink-faint)] mt-1">
        <span>0% sold</span>
        <span>you are here</span>
        <span>100% → graduation</span>
      </div>
    </div>
  );
}
