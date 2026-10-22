// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildMerchantItems } from '@/components/merchant/marketEngine';
import { CLEAR_FILTERS, DEFAULT_FILTERS, CLEANER_FILTERS, matchesMerchantFilters } from '@/components/merchant/merchantFilters';
const now = 1710000000;
const item = buildMerchantItems({ 1: { name: 'Test item', limit: 10000, members: true } },
  { 1: { high: 110, low: 100, highTime: now - 60, lowTime: now - 60 } },
  { 1: { avgHighPrice: 110, avgLowPrice: 100, highPriceVolume: 100000, lowPriceVolume: 100000 } },
  { nowSeconds: now, volumeTimestamp: now - 3600 })[0];
describe('Merchant filters', () => {
  it('keeps a fresh, sized ready trade in the default and cleaner presets', () => {
    expect(matchesMerchantFilters(item, DEFAULT_FILTERS)).toBe(true);
    expect(matchesMerchantFilters(item, CLEANER_FILTERS)).toBe(true);
  });
  it('uses batch capital, including disjoint boundaries, rather than unit price', () => {
    expect(matchesMerchantFilters({ ...item, buy: 100, capitalRequired: 1000000 }, { ...CLEAR_FILTERS, capital: '1mTo10m' })).toBe(true);
    expect(matchesMerchantFilters({ ...item, capitalRequired: 1000000 }, { ...CLEAR_FILTERS, capital: '100kTo1m' })).toBe(false);
    expect(matchesMerchantFilters({ ...item, capitalRequired: 10000000 }, { ...CLEAR_FILTERS, capital: '1mTo10m' })).toBe(false);
    expect(matchesMerchantFilters({ ...item, capitalRequired: 10000000 }, { ...CLEAR_FILTERS, capital: '10mPlus' })).toBe(true);
  });
  it('filters by after-tax batch profit, not per-item or buy-limit profit', () => {
    expect(matchesMerchantFilters({ ...item, profit: 500000, limitProfit: 10000000, expectedProfit: 9999 }, { ...CLEAR_FILTERS, minProfit: '10000' })).toBe(false);
    expect(matchesMerchantFilters({ ...item, profit: 8, expectedProfit: 10000 }, { ...CLEAR_FILTERS, minProfit: '10000' })).toBe(true);
  });
  it('checks both quote sides and excludes estimated/missing flow when requested', () => {
    expect(matchesMerchantFilters({ ...item, lastTradeAgeMinutes: 1, staleSideAgeMinutes: 31 }, DEFAULT_FILTERS)).toBe(false);
    expect(matchesMerchantFilters({ ...item, volumeEstimated: true }, DEFAULT_FILTERS)).toBe(true);
    expect(matchesMerchantFilters({ ...item, volumeEstimated: true }, CLEANER_FILTERS)).toBe(false);
    expect(matchesMerchantFilters({ ...item, hasRecentVolume: false }, CLEANER_FILTERS)).toBe(false);
    expect(matchesMerchantFilters({ ...item, expectedQuantity: 0 }, DEFAULT_FILTERS)).toBe(false);
  });
  it('uses slower-side flow and buy price for their thresholds', () => {
    expect(matchesMerchantFilters({ ...item, volume: 99 }, DEFAULT_FILTERS)).toBe(false);
    expect(matchesMerchantFilters({ ...item, buy: 99 }, DEFAULT_FILTERS)).toBe(false);
  });
  it('combines F2P and tax filters without hiding F2P from members', () => {
    expect(matchesMerchantFilters(item, { ...CLEAR_FILTERS, account: 'f2p' })).toBe(false);
    expect(matchesMerchantFilters({ ...item, members: false }, CLEAR_FILTERS)).toBe(true);
    expect(matchesMerchantFilters({ ...item, tax: 0, buy: 100 }, { ...CLEAR_FILTERS, taxFree: true })).toBe(true);
    expect(matchesMerchantFilters(item, { ...CLEAR_FILTERS, taxFree: true })).toBe(false);
  });
  it('cannot turn Caution or Wait into a Ready result', () => {
    for (const signal of ['Wait', 'Caution'] as const) {
      expect(matchesMerchantFilters({ ...item, signal }, CLEANER_FILTERS)).toBe(false);
    }
    expect(matchesMerchantFilters({ ...item, volatility: .18 }, { ...CLEAR_FILTERS, category: 'lowInstability' })).toBe(false);
    expect(matchesMerchantFilters({ ...item, expectedQuantity: 99 }, { ...CLEAR_FILTERS, category: 'bulk' })).toBe(false);
  });
  it('clear restores eligible candidates hidden by the default guardrails', () => {
    const thin = { ...item, volume: 10, buy: 1, expectedQuantity: 0, expectedProfit: 0, staleSideAgeMinutes: 100, hasRecentVolume: false };
    expect(matchesMerchantFilters(thin, DEFAULT_FILTERS)).toBe(false);
    expect(matchesMerchantFilters(thin, CLEAR_FILTERS)).toBe(true);
  });
});
