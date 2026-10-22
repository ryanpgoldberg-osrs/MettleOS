// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const now = 1710000000;
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
  vi.resetModules();
  delete (globalThis as typeof globalThis & { __mettleMerchantCacheV2__?: unknown }).__mettleMerchantCacheV2__;
  vi.spyOn(Date, 'now').mockReturnValue(now * 1000);
});
async function load(hourly: unknown, short: unknown) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/mapping')) return response([{ id: 1, name: 'Test item', limit: 10000 }]);
    if (url.endsWith('/latest')) return response({ data: { 1: { high: 200, low: 100, highTime: now, lowTime: now } } });
    const value = url.endsWith('/1h') ? hourly : short;
    if (value === null) throw new Error('unavailable');
    return response(value);
  });
  vi.stubGlobal('fetch', fetchMock);
  const { GET } = await import('@/app/api/prices/route');
  return { body: await (await GET()).json(), fetchMock };
}
const flow = { 1: { avgHighPrice: 200, avgLowPrice: 100, highPriceVolume: 100, lowPriceVolume: 100 } };
describe('merchant volume feeds', () => {
  it('uses the server timestamp and fresh hourly feed without fallback', async () => {
    const { body, fetchMock } = await load({ timestamp: now - 3600, data: flow }, null);
    expect(body.items[0]).toMatchObject({ volume: 100, volumeEstimated: false });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('falls back from expired hourly flow to scaled five-minute flow', async () => {
    const { body } = await load({ timestamp: now - 7201, data: flow }, { timestamp: now - 300, data: flow });
    expect(body.items[0]).toMatchObject({ volume: 1200, volumeEstimated: true, expectedQuantity: 15 });
  });
  it('keeps prices visible when both volume feeds fail', async () => {
    const { body } = await load(null, null);
    expect(body.items[0]).toMatchObject({ buy: 100, volume: 0, expectedQuantity: 0, signal: 'Wait' });
  });
});
