// The live price chart, split into its own module on purpose.
//
// `lightweight-charts` is the single heaviest dependency in the app (3 MB on
// disk) and it only renders on pool detail, so bundling it with the radar meant
// every visitor paid for a chart most never open. TokenDetail imports this
// lazily, which keeps it out of the initial chunk and loads it on the click
// that actually needs it.
//
// The `PricePoint` shape stays in BondingChart.tsx so the eager side can keep
// importing the type without pulling this module in. Types cost nothing at
// runtime, but a value import here would defeat the split.
import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { formatPrice } from '../lib/format';
import type { PricePoint } from './BondingChart';

const CHART_HEIGHT = 260;

export default function LiveChart({ history }: { history: PricePoint[] }) {
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
        textColor: 'rgba(13,12,11,0.42)',
        fontFamily: '"Inter Tight", "Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(13,12,11,0.05)' },
        horzLines: { color: 'rgba(13,12,11,0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(13,12,11,0.09)',
      },
      timeScale: {
        borderColor: 'rgba(13,12,11,0.09)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(13,12,11,0.3)', labelBackgroundColor: '#0d0c0b' },
        horzLine: { color: 'rgba(13,12,11,0.3)', labelBackgroundColor: '#0d0c0b' },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#0d0c0b',
      topColor: 'rgba(13,12,11,0.14)',
      bottomColor: 'rgba(13,12,11,0.01)',
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
        <span className="label">Live price · COOK / token</span>
        {history.length > 1 && (
          <span className="text-[10px] text-[color:var(--ink-faint)] num">{history.length} samples · this session</span>
        )}
      </div>
      <div className="relative">
        <div ref={containerRef} className="w-full" />
        {history.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[12px] text-[color:var(--ink-faint)] pointer-events-none">
            Collecting price samples… data appears on the next poll
          </div>
        )}
      </div>
    </div>
  );
}
