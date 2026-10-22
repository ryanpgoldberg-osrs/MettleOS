import { NextRequest, NextResponse } from 'next/server';
import { summarizeMarginHistory, type HistoryPoint } from '@/components/merchant/marginHistory';
import type { WikiMappingEntry } from '@/components/merchant/marketEngine';
export const runtime = 'nodejs';
const base = 'https://prices.runescape.wiki/api/v1/osrs';
const headers = { 'User-Agent': 'MettleOS merchant history (+https://github.com/ryanpgoldberg-osrs/MettleOS)' };
let metadata: { fetchedAt: number; names: Map<number, string> } | null = null;
let metadataPending: Promise<Map<number, string>> | null = null;
const cache = new Map<number, { fetchedAt: number; data: HistoryPoint[]; name: string }>();
const pending = new Map<number, Promise<{ data: HistoryPoint[]; name: string; fetchedAt: number }>>();
async function json<T>(url: string, seconds: number): Promise<T> {
  const res = await fetch(url, { headers, next: { revalidate: seconds }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Wiki returned ${res.status}`);
  return res.json();
}
async function names() {
  if (metadata && Date.now() - metadata.fetchedAt < 86400000) return metadata.names;
  if (!metadataPending) metadataPending = json<WikiMappingEntry[]>(`${base}/mapping`, 3600).then(data => {
    const names = new Map(data.map(item => [item.id, item.name]));
    metadata = { names, fetchedAt: Date.now() };
    return names;
  }).finally(() => { metadataPending = null; });
  return metadataPending;
}
async function load(id: number) {
  const entry = cache.get(id);
  if (entry && Date.now() - entry.fetchedAt < 300000) return entry;
  if (pending.has(id)) return pending.get(id)!;
  const task = (async () => {
    const name = (await names()).get(id);
    if (!name) return null;
    const series = await json<{ data: HistoryPoint[] }>(`${base}/timeseries?timestep=1h&id=${id}`, 300);
    if (!Array.isArray(series.data)) throw new Error('Invalid history response');
    const entry = { name, data: series.data, fetchedAt: Date.now() };
    // Bounded per-instance cache, fetched on demand for inspected items only.
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(id, entry);
    return entry;
  })();
  // Cache only successful, known-item results; failures remain retryable.
  const valid = task.then(value => { if (!value) throw new Error('UNKNOWN_ITEM'); return value; });
  pending.set(id, valid);
  try { return await valid; } finally { pending.delete(id); }
}
export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get('itemId') ?? '';
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0 || id > 1_000_000) return NextResponse.json({ error: 'Invalid item ID.' }, { status: 400 });
  try {
    const result = await load(id);
    return NextResponse.json({ itemId: id, name: result.name, fetchedAt: result.fetchedAt,
      summary: summarizeMarginHistory(result.data, result.name) },
    { headers: { 'Cache-Control': 'public, s-maxage=300' } });
  } catch (error) {
    const unknown = error instanceof Error && error.message === 'UNKNOWN_ITEM';
    return NextResponse.json({ error: unknown ? 'Unknown item.' : 'History is unavailable. Retry shortly.' }, { status: unknown ? 404 : 502 });
  }
}
