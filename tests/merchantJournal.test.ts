// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildMerchantItems } from '@/components/merchant/marketEngine';
import { startTrade, addFill, compareTrade, closeTrade, parseJournal, serializeJournal, summarizeJournal } from '@/components/merchant/tradeJournal';
const now = 1710028800000;
const item = buildMerchantItems({ 1: { name: 'Test', limit: 10000, members: false } },
  { 1: { high: 200, low: 100, highTime: now / 1000, lowTime: now / 1000 } },
  { 1: { avgHighPrice: 200, avgLowPrice: 100, highPriceVolume: 10000, lowPriceVolume: 10000 } },
  { nowSeconds: now / 1000, volumeTimestamp: now / 1000 - 3600 })[0];
const start = () => startTrade(item, 'trade-1', now);
describe('actual fill journal', () => {
  it('freezes the original sizing, prices, per-side timing and participation', () => {
    const t = start();
    expect(t.model).toMatchObject({ quantity: 125, profit: 12000, buy: 100, sell: 200, participation: .05, buyVolume: 10000, sellVolume: 10000 });
    expect(t.model).not.toBe(item);
    expect(() => startTrade({ ...item, expectedQuantity: 0 }, 'zero')).toThrow();
  });
  it('matches partial sales FIFO, charges tax per item and leaves unsold cost unrealized', () => {
    let t = addFill(start(), { side: 'buy', quantity: 2, price: 110, filledAt: now + 60000 });
    t = addFill(t, { side: 'buy', quantity: 2, price: 120, filledAt: now + 120000 });
    t = addFill(t, { side: 'sell', quantity: 3, price: 200, filledAt: now + 240000 });
    expect(compareTrade(t)).toMatchObject({ bought: 4, sold: 3, remaining: 1, realizedProfit: 248, tax: 12, modelForSoldQuantity: 288, profitDelta: -40, buyMinutes: 2, sellMinutes: 2, elapsedMinutes: 4 });
    t = addFill(t, { side: 'sell', quantity: 1, price: 100, filledAt: now + 300000 });
    const c = compareTrade(closeTrade(t, now + 600000));
    expect(c).toMatchObject({ remaining: 0, realizedProfit: 226, completed: true, elapsedMinutes: 5 });
  });
  it('does not invent profit from an unsold buy or erase failed attempts', () => {
    const bought = addFill(start(), { side: 'buy', quantity: 10, price: 100, filledAt: now + 60000 });
    expect(compareTrade(closeTrade(bought, now + 3600000))).toMatchObject({ realizedProfit: 0, remaining: 10, completed: false, elapsedMinutes: 60 });
    expect(summarizeJournal([closeTrade(start(), now + 60000)])).toMatchObject({ closed: 1, completed: 0, unfilled: 1, averageDurationRatio: null });
  });
  it('rejects overselling, out-of-order/future fills, unsafe totals, and fills after closing', () => {
    const t = addFill(start(), { side: 'buy', quantity: 1, price: 100, filledAt: now + 60000 });
    expect(() => addFill(t, { side: 'sell', quantity: 2, price: 100, filledAt: now + 120000 })).toThrow('exceeds');
    expect(() => addFill(t, { side: 'buy', quantity: 1, price: 100, filledAt: now })).toThrow('time');
    expect(() => addFill(t, { side: 'buy', quantity: 1, price: 100, filledAt: now + 120000 }, now + 60000)).toThrow('time');
    expect(() => addFill(t, { side: 'buy', quantity: 1.5, price: 100, filledAt: now + 120000 })).toThrow();
    expect(() => addFill(t, { side: 'buy', quantity: Number.MAX_SAFE_INTEGER, price: 100, filledAt: now + 120000 })).toThrow();
    expect(() => addFill(closeTrade(t), { side: 'sell', quantity: 1, price: 100, filledAt: Date.now() })).toThrow('closed');
  });
  it('roundtrips valid logs and rejects malformed storage instead of silently erasing it', () => {
    const t = closeTrade(addFill(start(), { side: 'buy', quantity: 2, price: 110, filledAt: now + 60000 }), now + 120000);
    expect(parseJournal(serializeJournal([t]))).toEqual([t]);
    expect(() => parseJournal('bad json')).toThrow();
    expect(() => parseJournal('{"version":2,"trades":[]}')).toThrow();
    expect(() => parseJournal(serializeJournal([t, t]))).toThrow();
    expect(() => parseJournal(serializeJournal([{ ...t, fills: [{ side: 'sell', quantity: 5, price: 100, filledAt: now + 60000 }] }]))).toThrow();
  });
});
