// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const now = 1710028800;
const response = (data: unknown) => new Response(JSON.stringify(data));
beforeEach(() => { vi.resetModules(); vi.spyOn(Date, 'now').mockReturnValue(now * 1000); });
async function handler() { return (await import('@/app/api/prices/history/route')).GET; }
const request = (id: string) => new NextRequest(`http://localhost/api/prices/history?itemId=${id}`);
describe('on-demand item history', () => {
  it('validates item IDs before any upstream request', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const GET = await handler();
    for (const id of ['', '-1', '1.5', 'abc', '1000001']) expect((await GET(request(id))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses canonical names for tax, caches requests, and exposes observed coverage', async () => {
    const fetch = vi.fn(async (url: string) => url.endsWith('/mapping') ? response([{ id: 1, name: 'Mind rune' }]) : response({ data: [{ timestamp: now - 3600, avgHighPrice: 101, avgLowPrice: 100, highPriceVolume: 100, lowPriceVolume: 100 }] }));
    vi.stubGlobal('fetch', fetch);
    const GET = await handler();
    const body = await (await GET(request('1'))).json();
    expect(body).toMatchObject({ name: 'Mind rune', summary: { sampleCount: 1, profitableSamples: 1, sufficient: false } });
    expect((await GET(request('1'))).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('coalesces requests for the same item and rejects unknown mapping IDs', async () => {
    const fetch = vi.fn(async (url: string) => url.endsWith('/mapping') ? response([{ id: 1, name: 'Test' }]) : response({ data: [] }));
    vi.stubGlobal('fetch', fetch);
    const GET = await handler();
    const results = await Promise.all([GET(request('1')), GET(request('1'))]);
    expect(results.every(r => r.status === 200)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await GET(request('2'))).status).toBe(404);
  });
  it('reports upstream failure honestly and permits retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response([{ id: 1, name: 'Test' }])).mockResolvedValueOnce(response({ data: [] })));
    const GET = await handler();
    expect((await GET(request('1'))).status).toBe(502);
    expect((await GET(request('1'))).status).toBe(200);
  });
});
