import { useEffect, useRef } from 'react';
import { AreaSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import { formatPrice } from '../lib/format';

export interface PricePoint {
  time: number; // epoch seconds
  price: number; // COOK per token
}

const CHART_HEIGHT = 280;

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
    return <div className="text-white/30 text-[11px]">Curve unavailable for this pool.</div>;
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
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/45">Bonding curve</span>
        <span className="text-[11px] text-white/55">{soldPct.toFixed(1)}% sold</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="bonding curve">
        <defs>
          <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(61,220,132,0.18)" />
            <stop offset="100%" stopColor="rgba(61,220,132,0)" />
          </linearGradient>
        </defs>
        <path d={`M ${pts.join(' L ')} L ${xOf(1).toFixed(1)},${H} L ${xOf(0).toFixed(1)},${H} Z`} fill="url(#curveFill)" />
        <path d={`M ${pts.join(' L ')}`} fill="none" stroke="rgba(61,220,132,0.9)" strokeWidth="1.5" />
        <line x1={xOf(1)} y1={PAD} x2={xOf(1)} y2={H - PAD} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
        <circle cx={curX} cy={curY} r="4" fill="#fff" />
        <circle cx={curX} cy={curY} r="7" fill="none" stroke="rgba(255,255,255,0.35)" />
      </svg>
      <div className="flex justify-between text-[10px] text-white/35 mt-1">
        <span>0% sold</span>
        <span>you are here</span>
        <span>100% → graduation</span>
      </div>
    </div>
  );
}

export function BondingChart({ history }: { history: PricePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height: CHART_HEIGHT,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255,255,255,0.55)',
        fontFamily: '"Space Mono", monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.25)', labelBackgroundColor: '#181818' },
        horzLine: { color: 'rgba(255,255,255,0.25)', labelBackgroundColor: '#181818' },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#3ddc84',
      topColor: 'rgba(61,220,132,0.25)',
      bottomColor: 'rgba(61,220,132,0.01)',
      lineWidth: 2,
      priceFormat: { type: 'custom', formatter: (p: number) => formatPrice(p) },
      priceLineVisible: true,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    if (history.length === 0) {
      series.setData([]);
      return;
    }
    series.setData(history.map((h) => ({ time: h.time as UTCTimestamp, value: h.price })));
    chart.timeScale().fitContent();
  }, [history]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/45">Live price · COOK / token</span>
        {history.length > 1 && <span className="text-[10px] text-white/35">{history.length} samples · session</span>}
      </div>
      <div className="relative">
        <div ref={containerRef} className="w-full" />
        {history.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/30 text-[12px] pointer-events-none">
            Collecting price samples… data appears on the next poll
          </div>
        )}
      </div>
    </div>
  );
}
