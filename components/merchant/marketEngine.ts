// Ported from MettleApps MerchantMobile/Core/Market/MarketEngine.swift.
export type WikiMappingEntry = { id: number; name: string; limit?: number | null; members?: boolean };
export type MappingById = Record<number, { name: string; limit: number; members: boolean }>;
export type WikiLatestEntry = { high?: number | null; low?: number | null; highTime?: number | null; lowTime?: number | null };
export type WikiHourlyEntry = { avgHighPrice?: number | null; avgLowPrice?: number | null; highPriceVolume?: number | null; lowPriceVolume?: number | null };
export type MerchantItem = ReturnType<typeof makeMerchantEntry> & {};
type Options = { nowSeconds?: number; volumeTimestamp: number; volumeWindowSeconds?: number; timeframeMinutes?: number; bankroll?: number };
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const exempt = new Set(['Mind rune', 'Energy potion(1)', 'Energy potion(2)', 'Energy potion(3)', 'Energy potion(4)']);
export function calculateTax(price: number, name?: string) {
  return price <= 0 || (name && exempt.has(name)) ? 0 : Math.min(5_000_000, Math.floor(price / 50));
}
export function makeMerchantEntry(id: number, mapping: MappingById[number], latest: WikiLatestEntry, hourly: WikiHourlyEntry | undefined, options: Options) {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const planMinutes = options.timeframeMinutes ?? 30;
  const window = options.volumeWindowSeconds ?? 3600;
  const volumeAge = now - options.volumeTimestamp;
  const hasRecentVolume = options.volumeTimestamp > 0 && volumeAge <= (window === 300 ? 1200 : 7200);
  // Passive buys meet instant sells (low side); passive sells meet instant buys (high side).
  const buyVolume = hasRecentVolume ? Math.max(0, hourly?.lowPriceVolume ?? 0) * (3600 / window) : 0;
  const sellVolume = hasRecentVolume ? Math.max(0, hourly?.highPriceVolume ?? 0) * (3600 / window) : 0;
  const volume = Math.min(buyVolume, sellVolume);
  const buy = latest.low ?? 0, sell = latest.high ?? 0;
  const age = (timestamp?: number | null) => timestamp ? Math.floor(Math.max(0, now - timestamp) / 60) : 360;
  const buyAgeMinutes = age(latest.lowTime), sellAgeMinutes = age(latest.highTime);
  const lastTradeAgeMinutes = Math.min(age(latest.highTime), age(latest.lowTime));
  const staleSideAgeMinutes = Math.max(age(latest.highTime), age(latest.lowTime));
  const maxStaleness = Math.min(180, Math.max(30, Math.round(planMinutes * 4.5)));
  const tax = calculateTax(sell, mapping.name), profit = sell - buy - tax;
  if (buy <= 0 || sell <= buy || profit <= 0 || staleSideAgeMinutes > maxStaleness || (hasRecentVolume && volume < 5)) return null;
  const limit = Math.max(1, mapping.limit || 1);
  const affordable = options.bankroll === undefined ? limit : Math.floor(Math.max(0, options.bankroll) / buy);
  const participation = 0.05;
  const cycleMinutesPerItem = volume > 0 ? 60 / (buyVolume * participation) + 60 / (sellVolume * participation) : Infinity;
  const expectedQuantity = Math.floor(Math.min(limit, affordable, planMinutes / cycleMinutesPerItem));
  const expectedProfit = profit * expectedQuantity, capitalRequired = buy * expectedQuantity;
  const expectedBuyMinutes = expectedQuantity > 0 ? expectedQuantity * 60 / (buyVolume * participation) : null;
  const expectedSellMinutes = expectedQuantity > 0 ? expectedQuantity * 60 / (sellVolume * participation) : null;
  const expectedDurationMinutes = expectedBuyMinutes !== null && expectedSellMinutes !== null
    ? Math.max(5, Math.ceil(expectedBuyMinutes + expectedSellMinutes)) : 180;
  const limitProfit = profit * limit, roi = profit / buy;
  let volatility = 1;
  if (hourly && hourly.avgHighPrice != null && hourly.avgLowPrice != null) {
    const mid = (sell + buy) / 2, baseline = (hourly.avgHighPrice + hourly.avgLowPrice) / 2;
    const spread = Math.max(1, sell - buy), baselineSpread = Math.max(1, hourly.avgHighPrice - hourly.avgLowPrice);
    volatility = clamp(Math.abs(mid - baseline) / Math.max(1, baseline) * 18 + Math.abs(spread - baselineSpread) / Math.max(spread, baselineSpread) * 0.65);
  }
  const freshness = Math.max(0, 1 - staleSideAgeMinutes / maxStaleness);
  const liquidity = Math.min(1, volume / 135), stability = 1 - volatility;
  const targetProfit = 90000 * Math.max(1, planMinutes / 30);
  const durationFit = Math.min(1, planMinutes / Math.max(5, expectedDurationMinutes));
  const confidenceValue = clamp(freshness * .20 + stability * .19 + liquidity * .18 + durationFit * .15 + Math.min(1, expectedProfit / targetProfit) * .16 + Math.min(1, limitProfit / 120000) * .07 + Math.min(1, roi / .06) * .05 + (lastTradeAgeMinutes <= 5 ? .08 : 0));
  const thin = !(volume / 135 >= .4 || volume >= 25);
  const recommendationRisk = volatility >= .34 || staleSideAgeMinutes >= 30 || thin || volumeAge > 5400 || capitalRequired >= 8000000 ? 'High' : staleSideAgeMinutes >= 10 || window === 300 || volatility >= .18 || capitalRequired >= 600000 ? 'Medium' : 'Low';
  let signal: 'Flip' | 'Caution' | 'Wait' = 'Wait';
  if (profit > 0 && expectedProfit > 0) {
    if (confidenceValue >= .66 && staleSideAgeMinutes <= Math.min(planMinutes, 10) && expectedProfit >= 1000 && volatility < .34 && volume >= 16 && expectedDurationMinutes <= Math.max(5, Math.round(planMinutes * 1.15))) signal = 'Flip';
    else if (confidenceValue >= .4) signal = 'Caution';
  }
  if (!hasRecentVolume || volumeAge > 7200) signal = 'Wait';
  if (signal === 'Flip' && recommendationRisk === 'High') signal = 'Caution';
  const profitScore = clamp(Math.min(1, expectedProfit / targetProfit) * .65 + Math.min(1, limitProfit / 150000) * .35);
  const efficiency = clamp(Math.min(1, roi / .08) * .6 + durationFit * .4);
  const accessibility = capitalRequired < 600000 ? 1 : capitalRequired < 8000000 ? .72 : .4;
  const fit = clamp(accessibility * .72 + Math.min(1, limit / 100) * .28);
  const score = 100 * (profitScore * .24 + liquidity * .18 + efficiency * .17 + stability * .15 + clamp(confidenceValue * .72 + freshness * .28) * .16 + fit * .10);
  return { source: { latest, hourly: hourly ?? null, volumeTimestamp: options.volumeTimestamp, volumeWindowSeconds: window },
    buyVolume, sellVolume, buyAgeMinutes, sellAgeMinutes, expectedBuyMinutes, expectedSellMinutes, participation,
    id, ...mapping, limit, buy, sell, tax, profit, roi: roi * 100, volume, limitProfit, expectedQuantity, expectedProfit, capitalRequired, expectedDurationMinutes, planMinutes, volatility, recommendationRisk, volumeEstimated: window === 300, hasRecentVolume, lastTradeAgeMinutes, staleSideAgeMinutes, confidence: Math.round(confidenceValue * 100), signal, score };
}
export function buildMerchantItems(mapping: MappingById, latest: Record<string, WikiLatestEntry>, hourly: Record<string, WikiHourlyEntry>, options: Options) {
  return Object.entries(latest).flatMap(([key, quote]) => {
    const id = Number(key);
    const item = mapping[id] && makeMerchantEntry(id, mapping[id], quote, hourly[key], options);
    return item ? [item] : [];
  }).sort((a, b) => b.score - a.score || b.profit - a.profit);
}

// Rebuild all dependent fields, including confidence, risk and rank, after a budget change.
export function resizeMerchantItem(item: MerchantItem, bankroll?: number, nowSeconds = Math.floor(Date.now() / 1000)) {
  return makeMerchantEntry(item.id, { name: item.name, members: item.members, limit: item.limit },
    item.source.latest, item.source.hourly ?? undefined,
    { ...item.source, nowSeconds, bankroll, timeframeMinutes: item.planMinutes });
}

export function parseBankroll(value: string): number | undefined {
  if (!value.trim()) return undefined;
  if (!/^\d+$/.test(value.trim())) throw new Error('Enter a whole number of gp, or leave bankroll blank.');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Bankroll must be a non-negative safe whole number.');
  return amount;
}
