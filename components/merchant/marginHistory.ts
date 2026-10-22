import { calculateTax } from './marketEngine';
export type HistoryPoint = {
  timestamp: number; avgHighPrice?: number | null; avgLowPrice?: number | null;
  highPriceVolume?: number | null; lowPriceVolume?: number | null;
};
export function summarizeMarginHistory(points: HistoryPoint[], itemName: string, now = Math.floor(Date.now() / 1000)) {
  // Use the last 24 completed UTC hour buckets. Do not treat absent trades as zero prices.
  const end = Math.floor(now / 3600) * 3600, start = end - 86400;
  const buckets = new Map<number, HistoryPoint>();
  for (const point of points) {
    if (!point || typeof point !== 'object') continue;
    if (Number.isSafeInteger(point.timestamp) && point.timestamp % 3600 === 0 && point.timestamp >= start && point.timestamp < end) buckets.set(point.timestamp, point);
  }
  const samples = [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp).flatMap((p) => {
    if (!Number.isSafeInteger(p.avgHighPrice) || !Number.isSafeInteger(p.avgLowPrice)
        || (p.avgHighPrice ?? 0) <= 0 || (p.avgLowPrice ?? 0) <= 0
        || !Number.isFinite(p.highPriceVolume) || !Number.isFinite(p.lowPriceVolume)
        || (p.highPriceVolume ?? 0) <= 0 || (p.lowPriceVolume ?? 0) <= 0) return [];
    const sell = p.avgHighPrice!, buy = p.avgLowPrice!;
    return [{ timestamp: p.timestamp, buy, sell, margin: sell - buy - calculateTax(sell, itemName), crossed: sell < buy }];
  });
  const count = samples.length;
  const profitable = samples.filter(p => p.margin > 0).length;
  const crossed = samples.filter(p => p.crossed).length;
  const margins = samples.map(p => p.margin).sort((a,b) => a - b);
  const medianMargin = count ? (margins[Math.floor((count - 1) / 2)] + margins[Math.floor(count / 2)]) / 2 : null;
  const latestSampleAt = samples.at(-1)?.timestamp ?? null;
  return {
    windowStart: start, windowEnd: end, expectedSamples: 24, sampleCount: count,
    coveragePercent: count / 24 * 100, profitableSamples: profitable, crossedSamples: crossed,
    profitablePercent: count ? profitable / count * 100 : null,
    crossedPercent: count ? crossed / count * 100 : null, medianMargin,
    latestSampleAt, stale: latestSampleAt === null || now - (latestSampleAt + 3600) > 7200,
    sufficient: count >= 12, samples,
  };
}
