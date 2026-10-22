import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTradeJournal } from '@/components/merchant/MerchantFillJournal';
import { JOURNAL_KEY, serializeJournal, startTrade } from '@/components/merchant/tradeJournal';
import { buildMerchantItems } from '@/components/merchant/marketEngine';
let root: Root;
let journal: ReturnType<typeof useTradeJournal>;
let container: HTMLDivElement;
const now = Math.floor(Date.now() / 1000) * 1000;
const item = buildMerchantItems({ 1: { name: 'Test', limit: 10000, members: false } },
  { 1: { high: 200, low: 100, highTime: now / 1000, lowTime: now / 1000 } },
  { 1: { avgHighPrice: 200, avgLowPrice: 100, highPriceVolume: 10000, lowPriceVolume: 10000 } },
  { nowSeconds: now / 1000, volumeTimestamp: now / 1000 - 3600 })[0];
function Harness() { const current = useTradeJournal(); useEffect(() => { journal = current; }, [current]); return createElement('span', null, current.error); }
async function mount() {
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(createElement(Harness)); });
}
beforeEach(async () => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); await mount(); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
describe('local fill journal persistence', () => {
  it('persists a frozen model plus actual buy/sell fills across remounts', async () => {
    await act(async () => { expect(journal.start(item)).toBe(true); });
    const id = journal.trades[0].id;
    await act(async () => { expect(journal.fill(id, { side: 'buy', quantity: 3, price: 100, filledAt: Date.now() })).toBe(true); });
    await act(async () => { expect(journal.fill(id, { side: 'sell', quantity: 3, price: 200, filledAt: Date.now() })).toBe(true); });
    await act(async () => { expect(journal.close(id)).toBe(true); });
    const saved = journal.trades;
    await act(async () => root.unmount()); container.remove();
    await mount();
    expect(journal.trades).toEqual(saved);
    expect(journal.trades[0].model.quantity).toBe(125);
    expect(journal.trades[0].fills).toHaveLength(2);
    expect(journal.error).toBe('');
  });
  it('never reports a successful record when browser storage rejects the write', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage full'); });
    await act(async () => { expect(journal.start(item)).toBe(false); });
    expect(journal.trades).toEqual([]);
    expect(journal.error).toBe('Storage full');
  });
  it('detects concurrent edits and requires reload instead of overwriting another tab', async () => {
    const elsewhere = startTrade(item, 'other-tab');
    localStorage.setItem(JOURNAL_KEY, serializeJournal([elsewhere]));
    await act(async () => { expect(journal.start(item)).toBe(false); });
    expect(journal.error).toContain('another tab');
    expect(localStorage.getItem(JOURNAL_KEY)).toBe(serializeJournal([elsewhere]));
    await act(async () => journal.retry());
    expect(journal.trades[0].id).toBe('other-tab');
    await act(async () => { expect(journal.start(item)).toBe(true); });
    expect(journal.trades).toHaveLength(2);
  });
  it('preserves unreadable storage and refuses to overwrite it', async () => {
    await act(async () => root.unmount()); container.remove();
    localStorage.setItem(JOURNAL_KEY, 'unreadable');
    await mount();
    await act(async () => { expect(journal.start(item)).toBe(false); });
    expect(journal.error).toContain('could not be read');
    expect(localStorage.getItem(JOURNAL_KEY)).toBe('unreadable');
  });
  it('permits a corrected fill after a validation error without discarding prior fills', async () => {
    await act(async () => { journal.start(item); });
    const id = journal.trades[0].id;
    await act(async () => { expect(journal.fill(id, { side: 'sell', quantity: 1, price: 200, filledAt: Date.now() })).toBe(false); });
    await act(async () => { expect(journal.fill(id, { side: 'buy', quantity: 1, price: 100, filledAt: Date.now() })).toBe(true); });
    expect(journal.trades[0].fills).toHaveLength(1);
    expect(journal.error).toBe('');
  });
});
