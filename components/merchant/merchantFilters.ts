import type { MerchantItem } from './marketEngine';

export const FILTER_FIELDS = [
  { key: 'category', label: 'Category', options: [['all', 'All signals'], ['ready', 'Ready only'], ['lowInstability', 'Low price instability'], ['bulk', 'Bulk (100+ items)']] },
  { key: 'capital', label: 'Batch capital', options: [['any', 'Any capital'], ['under100k', 'Under 100K'], ['100kTo1m', '100K – 1M'], ['1mTo10m', '1M – 10M'], ['10mPlus', '10M+']] },
  { key: 'minVolume', label: 'Min slower-side flow / hr', options: [['0', 'Any flow'], ['100', '100+'], ['500', '500+'], ['1000', '1K+'], ['5000', '5K+'], ['10000', '10K+']] },
  { key: 'minPrice', label: 'Min buy price', options: [['0', 'Any price'], ['10', '10+ gp'], ['100', '100+ gp'], ['1000', '1K+ gp'], ['10000', '10K+ gp'], ['100000', '100K+ gp']] },
  { key: 'minProfit', label: 'Min modeled batch profit', options: [['0', 'Any profit'], ['1000', '1K+ gp'], ['10000', '10K+ gp'], ['50000', '50K+ gp'], ['100000', '100K+ gp'], ['500000', '500K+ gp'], ['1000000', '1M+ gp']] },
  { key: 'maxAge', label: 'Both price sides within', options: [['135', 'Any eligible age'], ['30', '30 minutes'], ['10', '10 minutes'], ['5', '5 minutes']] },
  { key: 'account', label: 'Account', options: [['members', 'Members (all items)'], ['f2p', 'F2P only']] },
] as const;
export type MerchantFilters = {
  category: string; capital: string; minVolume: string; minPrice: string;
  minProfit: string; maxAge: string; account: string;
  taxFree: boolean; freshFlow: boolean; sizedOnly: boolean;
};
export const CLEAR_FILTERS: MerchantFilters = {
  category: 'all', capital: 'any', minVolume: '0', minPrice: '0', minProfit: '0',
  maxAge: '135', account: 'members', taxFree: false, freshFlow: false, sizedOnly: false,
};
export const DEFAULT_FILTERS: MerchantFilters = {
  ...CLEAR_FILTERS, minVolume: '100', minPrice: '100', maxAge: '30', freshFlow: false, sizedOnly: true,
};
export const CLEANER_FILTERS: MerchantFilters = {
  ...DEFAULT_FILTERS, category: 'ready', minVolume: '500', maxAge: '10', freshFlow: true,
};
const capitalRanges: Record<string, [number, number]> = {
  any: [0, Infinity], under100k: [0, 100_000], '100kTo1m': [100_000, 1_000_000],
  '1mTo10m': [1_000_000, 10_000_000], '10mPlus': [10_000_000, Infinity],
};
export function matchesMerchantFilters(item: MerchantItem, filters: MerchantFilters) {
  const [minCapital, maxCapital] = capitalRanges[filters.capital] ?? capitalRanges.any;
  if (item.capitalRequired < minCapital || item.capitalRequired >= maxCapital) return false;
  if (filters.account === 'f2p' && item.members) return false;
  if (filters.taxFree && item.tax !== 0) return false;
  if (filters.freshFlow && (!item.hasRecentVolume || item.volumeEstimated)) return false;
  if (filters.sizedOnly && item.expectedQuantity <= 0) return false;
  if (item.volume < Number(filters.minVolume) || item.buy < Number(filters.minPrice)
      || item.expectedProfit < Number(filters.minProfit) || item.staleSideAgeMinutes > Number(filters.maxAge)) return false;
  if (filters.category === 'ready' && item.signal !== 'Flip') return false;
  if (filters.category === 'lowInstability' && item.volatility >= 0.18) return false;
  if (filters.category === 'bulk' && item.expectedQuantity < 100) return false;
  return true;
}
