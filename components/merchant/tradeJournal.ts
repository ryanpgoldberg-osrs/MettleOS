import { calculateTax, type MerchantItem } from './marketEngine';
export const JOURNAL_KEY = 'mettle_merchant_fills_v1';
export type Fill = { side: 'buy' | 'sell'; quantity: number; price: number; filledAt: number };
export type Trade = {
  id: string; itemId: number; name: string; startedAt: number; endedAt: number | null;
  model: { quantity: number; unitProfit: number; profit: number; buy: number; sell: number;
    durationMinutes: number; buyMinutes: number | null; sellMinutes: number | null;
    buyVolume: number; sellVolume: number; participation: number; signal: string; volumeEstimated: boolean };
  fills: Fill[];
};
const safeWhole = (value: number) => Number.isSafeInteger(value) && value >= 0;
export function startTrade(item: MerchantItem, id: string, now = Date.now()): Trade {
  if (!safeWhole(item.expectedQuantity) || item.expectedQuantity < 1) throw new Error('Choose a batch with at least one modeled item.');
  return { id, itemId: item.id, name: item.name, startedAt: Math.floor(now / 1000) * 1000, endedAt: null, fills: [],
    model: { quantity: item.expectedQuantity, unitProfit: item.profit, profit: item.expectedProfit,
      buy: item.buy, sell: item.sell, durationMinutes: item.expectedDurationMinutes,
      buyMinutes: item.expectedBuyMinutes, sellMinutes: item.expectedSellMinutes,
      buyVolume: item.buyVolume, sellVolume: item.sellVolume, participation: item.participation,
      signal: item.signal, volumeEstimated: item.volumeEstimated } };
}
export function compareTrade(trade: Trade) {
  const buys: { remaining: number; price: number }[] = [];
  let bought = 0, sold = 0, cost = 0, revenue = 0, matchedCost = 0, tax = 0;
  for (const fill of trade.fills) {
    if (fill.side === 'buy') {
      buys.push({ remaining: fill.quantity, price: fill.price });
      bought += fill.quantity; cost += fill.quantity * fill.price;
    } else {
      let remaining = fill.quantity;
      for (const buy of buys) {
        const matched = Math.min(remaining, buy.remaining);
        matchedCost += matched * buy.price;
        remaining -= matched; buy.remaining -= matched;
        if (!remaining) break;
      }
      sold += fill.quantity;
      revenue += fill.quantity * fill.price;
      tax += fill.quantity * calculateTax(fill.price, trade.name);
    }
  }
  const lastBuy = trade.fills.filter(f => f.side === 'buy').at(-1)?.filledAt;
  const lastSell = trade.fills.filter(f => f.side === 'sell').at(-1)?.filledAt;
  const end = bought > 0 && sold === bought ? lastSell : trade.endedAt ?? lastSell;
  const realizedProfit = revenue - tax - matchedCost;
  const elapsedMinutes = end === undefined || end === null ? null : (end - trade.startedAt) / 60000;
  const modelForSoldQuantity = sold * trade.model.unitProfit;
  return { bought, sold, remaining: bought - sold, cost, revenue, tax, realizedProfit,
    modelForSoldQuantity, profitDelta: realizedProfit - modelForSoldQuantity,
    plannedBatchDelta: realizedProfit - trade.model.profit,
    buyMinutes: lastBuy === undefined ? null : (lastBuy - trade.startedAt) / 60000,
    sellMinutes: lastBuy === undefined || lastSell === undefined || lastSell < lastBuy ? null : (lastSell - lastBuy) / 60000,
    elapsedMinutes, quantityPercent: trade.model.quantity > 0 ? sold / trade.model.quantity * 100 : 0,
    completed: trade.endedAt !== null && bought > 0 && sold === bought,
  };
}
export function addFill(trade: Trade, fill: Fill, now = Date.now()): Trade {
  if (trade.endedAt !== null) throw new Error('This trade is closed. Start a new flip to log more fills.');
  if (trade.fills.length >= 200) throw new Error('This trade has reached its 200-fill limit.');
  if (fill.side !== 'buy' && fill.side !== 'sell') throw new Error('Select a buy or sell fill.');
  if (!safeWhole(fill.quantity) || fill.quantity < 1 || !safeWhole(fill.price) || fill.price < 1
      || !Number.isSafeInteger(fill.quantity * fill.price)) throw new Error('Quantity and price must be positive whole numbers with a safe total.');
  const last = trade.fills.at(-1)?.filledAt ?? trade.startedAt;
  if (!Number.isFinite(fill.filledAt) || fill.filledAt < last || fill.filledAt > now) throw new Error('Fill time must follow the start/previous fill and cannot be in the future.');
  const totals = compareTrade(trade);
  if (fill.side === 'sell' && fill.quantity > totals.remaining) throw new Error('Sell quantity exceeds the recorded unsold buys.');
  const total = fill.quantity * fill.price + totals.cost + totals.revenue;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(totals.bought + fill.quantity)) throw new Error('Recorded totals exceed the supported range.');
  return { ...trade, fills: [...trade.fills, fill] };
}
export function closeTrade(trade: Trade, now = Date.now()): Trade {
  if (trade.endedAt !== null) return trade;
  if (!Number.isFinite(now) || now < (trade.fills.at(-1)?.filledAt ?? trade.startedAt)) throw new Error('Close time precedes the last fill.');
  return { ...trade, endedAt: now };
}
export function summarizeJournal(trades: Trade[]) {
  const closed = trades.filter(t => t.endedAt !== null);
  const complete = closed.filter(t => compareTrade(t).completed);
  return {
    closed: closed.length, completed: complete.length, open: trades.length - closed.length,
    unfilled: closed.filter(t => compareTrade(t).bought === 0).length,
    realizedProfit: trades.reduce((sum,t) => sum + compareTrade(t).realizedProfit, 0),
    averageDurationRatio: complete.length ? complete.reduce((sum,t) => sum + (compareTrade(t).elapsedMinutes ?? 0) / t.model.durationMinutes, 0) / complete.length : null,
  };
}
// Validate persisted data by replaying each fill rather than trusting browser storage.
export function parseJournal(raw: string | null): Trade[] {
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.trades) || value.trades.length > 500) throw new Error('Unsupported or oversized fill journal.');
  const ids = new Set<string>();
  return value.trades.map((t: Trade) => {
    if (!t || typeof t.id !== 'string' || !t.id || ids.has(t.id) || typeof t.name !== 'string' || t.name.length > 200
        || !safeWhole(t.itemId) || !safeWhole(t.startedAt) || t.startedAt > Date.now() || !Array.isArray(t.fills) || !t.model
        || !safeWhole(t.model.quantity) || t.model.quantity < 1 || !safeWhole(t.model.profit)
        || typeof t.model.signal !== 'string' || typeof t.model.volumeEstimated !== 'boolean'
        || t.model.participation <= 0 || t.model.participation > 1
        || t.model.buy <= 0 || t.model.sell <= 0 || t.model.buyVolume < 0 || t.model.sellVolume < 0
        || !safeWhole(t.model.unitProfit) || !Number.isFinite(t.model.durationMinutes) || t.model.durationMinutes <= 0
        || !['buy', 'sell', 'buyVolume', 'sellVolume', 'participation'].every(key => Number.isFinite(t.model[key as keyof Trade['model']]))
        || ![t.model.buyMinutes, t.model.sellMinutes].every(v => v === null || (Number.isFinite(v) && v >= 0))) throw new Error('Invalid journal record.');
    ids.add(t.id);
    let trade = { ...t, fills: [] as Fill[], endedAt: null } as Trade;
    for (const fill of t.fills) trade = addFill(trade, fill);
    if (t.endedAt !== null) {
      if (!Number.isFinite(t.endedAt) || t.endedAt! > Date.now()) throw new Error('Invalid close time.');
      trade = closeTrade(trade, t.endedAt!);
    }
    return trade;
  });
}
export function serializeJournal(trades: Trade[]) { return JSON.stringify({ version: 1, trades }); }
