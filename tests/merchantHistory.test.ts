// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { summarizeMarginHistory, type HistoryPoint } from '@/components/merchant/marginHistory';
const now = 1710028800;
const point = (offset: number, high = 110, low = 100): HistoryPoint => ({ timestamp: now - offset * 3600, avgHighPrice: high, avgLowPrice: low, highPriceVolume: 20, lowPriceVolume: 10 });
describe('historical margin observations', () => {
  it('uses after-tax profitability and keeps crossed sides crossed', () => {
    const s = summarizeMarginHistory([point(1), point(2, 100, 110), point(3, 101, 100)], 'Test', now);
    expect(s).toMatchObject({ sampleCount: 3, profitableSamples: 1, crossedSamples: 1, sufficient: false, stale: false });
    expect(s.profitablePercent).toBeCloseTo(100 / 3);
    expect(s.samples[1]).toMatchObject({ buy: 110, sell: 100, margin: -12, crossed: true });
  });
  it('ignores missing, invalid and one-sided hours without inventing profitability', () => {
    const s = summarizeMarginHistory([point(1), { ...point(2), avgLowPrice: null }, { ...point(3), lowPriceVolume: 0 }, { ...point(4), avgHighPrice: NaN }], 'Test', now);
    expect(s.sampleCount).toBe(1);
    expect(s.profitablePercent).toBe(100);
    expect(s.coveragePercent).toBeCloseTo(100 / 24);
    expect(s.sufficient).toBe(false);
  });
  it('excludes unfinished, future and out-of-window buckets; deduplicates', () => {
    const s = summarizeMarginHistory([point(0), point(-1), point(25), point(1), point(1)], 'Test', now);
    expect(s.sampleCount).toBe(1);
  });
  it('labels stale/missing history without a success percentage', () => {
    expect(summarizeMarginHistory([], 'Test', now)).toMatchObject({ sampleCount: 0, profitablePercent: null, crossedPercent: null, medianMargin: null, stale: true });
    expect(summarizeMarginHistory([point(4)], 'Test', now).stale).toBe(true);
  });
  it('uses maintained tax exemptions and requires adequate coverage', () => {
    const points = Array.from({ length: 24 }, (_, i) => point(i + 1, 101, 100));
    expect(summarizeMarginHistory(points, 'Mind rune', now)).toMatchObject({ profitableSamples: 24, sufficient: true, coveragePercent: 100 });
    expect(summarizeMarginHistory(points, 'Test', now).profitableSamples).toBe(0);
  });
});
