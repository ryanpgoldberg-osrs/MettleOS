// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildMerchantItems, calculateTax, resizeMerchantItem, parseBankroll } from '@/components/merchant/marketEngine';
const now = 1710000000;
const mapping = { 1: { name: 'Test item', members: false, limit: 10000 } };
function entries(high = 200, low = 100, volume = 10000, timestamp = now - 3600, baselineHigh = high, options = {}) {
  return buildMerchantItems(mapping, { 1: { high, low, highTime: now - 60, lowTime: now - 60 } }, { 1: { avgHighPrice: baselineHigh, avgLowPrice: low, highPriceVolume: volume, lowPriceVolume: volume } }, { nowSeconds: now, volumeTimestamp: timestamp, ...options });
}
describe('Merchant model port', () => {
  it('preserves live side identities and cannot fabricate a crossed spread', () => {
    expect(entries(100, 110, 10000, now, 140)).toEqual([]);
    expect(entries()[0]).toMatchObject({ buy: 100, sell: 200, tax: 4, profit: 96 });
  });
  it('uses the same two-leg assumptions for quantity, duration and bankroll', () => {
    expect(entries()[0]).toMatchObject({ expectedQuantity: 125, expectedDurationMinutes: 30, expectedProfit: 12000 });
    expect(entries(200, 100, 10000, now - 3600, 200, { bankroll: 1000 })[0]).toMatchObject({ expectedQuantity: 10, capitalRequired: 1000, expectedProfit: 960 });
  });
  it('allows cheap bulk trades and refuses an unfillable window', () => {
    expect(entries(110, 100, 100000)[0].signal).toBe('Flip');
    expect(entries(200, 100, 16)[0]).toMatchObject({ expectedQuantity: 0, signal: 'Wait' });
  });
  it('retains fresh quotes but pauses sizing when flow expires', () => {
    expect(entries(200, 100, 10000, now - 7201)[0]).toMatchObject({ volume: 0, expectedQuantity: 0, signal: 'Wait', recommendationRisk: 'High' });
  });
  it('does not mark an unstable spread ready', () => {
    expect(entries(200, 100, 10000, now - 3600, 105)[0].signal).not.toBe('Flip');
  });
  it('scales five-minute flow and sizes sequential legs from their own volumes', () => {
    const item = buildMerchantItems(mapping, { 1: { high: 200, low: 100, highTime: now, lowTime: now } }, { 1: { avgHighPrice: 200, avgLowPrice: 100, highPriceVolume: 1000, lowPriceVolume: 100 } }, { nowSeconds: now, volumeTimestamp: now - 300, volumeWindowSeconds: 300 })[0];
    expect(item).toMatchObject({ volume: 1200, expectedQuantity: 27, volumeEstimated: true, recommendationRisk: 'Medium' });
  });
  it('treats a missing quote timestamp as stale', () => {
    expect(buildMerchantItems(mapping, { 1: { high: 200, low: 100, highTime: now } }, {}, { nowSeconds: now, volumeTimestamp: now })).toEqual([]);
  });
  it('matches tax thresholds, cap and confirmed exemptions', () => {
    expect([49, 50, 149, 250000000].map(x => calculateTax(x))).toEqual([0, 1, 2, 5000000]);
    expect(calculateTax(100, 'Mind rune')).toBe(0);
    expect(calculateTax(100, 'Energy potion(4)')).toBe(0);
    expect(calculateTax(100, 'Mud rune')).toBe(2);
  });
});

describe('bankroll and per-side execution', () => {
  it('pairs low-side flow with buying and high-side flow with selling', () => {
    const item = buildMerchantItems(mapping, { 1: { high: 200, low: 100, highTime: now - 120, lowTime: now - 300 } }, { 1: { avgHighPrice: 200, avgLowPrice: 100, highPriceVolume: 1000, lowPriceVolume: 100 } }, { nowSeconds: now, volumeTimestamp: now - 3600 })[0];
    expect(item).toMatchObject({ buyVolume: 100, sellVolume: 1000, buyAgeMinutes: 5, sellAgeMinutes: 2, expectedQuantity: 2 });
    expect(item.expectedBuyMinutes).toBeCloseTo(24);
    expect(item.expectedSellMinutes).toBeCloseTo(2.4);
    expect(item.expectedDurationMinutes).toBe(27);
  });
});

describe('resizing an existing quote', () => {
  it('recalculates rank, confidence, profit and quantity while preserving the original', () => {
    const original = entries()[0];
    const sized = resizeMerchantItem(original, 1000, now)!;
    expect(sized).toMatchObject({ expectedQuantity: 10, expectedProfit: 960, capitalRequired: 1000 });
    expect(sized.confidence).not.toBe(original.confidence);
    expect(sized.score).not.toBe(original.score);
    expect(original.expectedQuantity).toBe(125);
    expect(resizeMerchantItem(original, undefined, now)).toEqual(original);
  });
  it('distinguishes a zero budget from an unset budget and rejects malformed inputs', () => {
    expect(resizeMerchantItem(entries()[0], 0, now)).toMatchObject({ expectedQuantity: 0, expectedProfit: 0, signal: 'Wait', expectedBuyMinutes: null });
    expect(parseBankroll('')).toBeUndefined();
    expect(parseBankroll('0')).toBe(0);
    expect(parseBankroll('1000000')).toBe(1000000);
    for (const value of ['-1', '1.5', '1e6', 'NaN', '99999999999999999999']) expect(() => parseBankroll(value)).toThrow();
  });
  it('does not revive stale quotes during resizing', () => {
    expect(resizeMerchantItem(entries()[0], 1000, now + 86400)).toBeNull();
  });
});
