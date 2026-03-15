import { NextResponse } from "next/server";

export const runtime = "nodejs";

const REPO_URL = "https://github.com/ryanpgoldberg-osrs/MettleOS";
const MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping";
const LATEST_URL = "https://prices.runescape.wiki/api/v1/osrs/latest";
const HOURLY_URL = "https://prices.runescape.wiki/api/v1/osrs/1h";

const DATA_TTL_MS = 60_000;
const MAPPING_TTL_MS = 24 * 60 * 60_000;

const HEADERS = {
  "User-Agent": `MettleOS merchant utility (+${REPO_URL})`,
};

type WikiMappingEntry = {
  id: number;
  name: string;
  limit?: number | null;
  members?: boolean;
};

type WikiLatestEntry = {
  high?: number | null;
  low?: number | null;
  highTime?: number | null;
  lowTime?: number | null;
};

type WikiHourlyEntry = {
  avgHighPrice?: number | null;
  avgLowPrice?: number | null;
  highPriceVolume?: number | null;
  lowPriceVolume?: number | null;
};

type MerchantSignal = "Flip" | "Caution" | "Wait";

type MappingById = Record<
  number,
  {
    name: string;
    limit: number;
    members: boolean;
  }
>;

type MerchantItem = {
  id: number;
  name: string;
  members: boolean;
  limit: number;
  buy: number;
  sell: number;
  tax: number;
  profit: number;
  roi: number;
  volume: number;
  limitProfit: number;
  lastTradeAgeMinutes: number;
  staleSideAgeMinutes: number;
  confidence: number;
  signal: MerchantSignal;
  score: number;
};

type MerchantCache = {
  cachedAt: number;
  mappingFetchedAt: number;
  mappingById: MappingById;
  items: MerchantItem[];
};

const globalMerchantCache = globalThis as typeof globalThis & {
  __mettleMerchantCache__?: MerchantCache;
};

const cache =
  globalMerchantCache.__mettleMerchantCache__ ??
  (globalMerchantCache.__mettleMerchantCache__ = {
    cachedAt: 0,
    mappingFetchedAt: 0,
    mappingById: {},
    items: [],
  });

function calculateTax(price: number) {
  if (price < 100) return 0;
  return Math.min(Math.floor(price * 0.01), 5_000_000);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function fetchJson<T>(url: string, revalidateSeconds: number) {
  const res = await fetch(url, {
    headers: HEADERS,
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new Error(`RuneScape Wiki price API returned ${res.status} for ${url}`);
  }

  return (await res.json()) as T;
}

async function loadMapping() {
  const now = Date.now();
  if (cache.mappingFetchedAt && now - cache.mappingFetchedAt < MAPPING_TTL_MS) {
    return cache.mappingById;
  }

  const mapping = await fetchJson<WikiMappingEntry[]>(MAPPING_URL, 3600);
  const mappingById: MappingById = {};

  for (const item of mapping) {
    if (!item || typeof item.id !== "number" || !item.name) continue;
    mappingById[item.id] = {
      name: item.name,
      limit: typeof item.limit === "number" ? item.limit : 0,
      members: Boolean(item.members),
    };
  }

  cache.mappingById = mappingById;
  cache.mappingFetchedAt = now;
  return mappingById;
}

function buildMerchantItems(
  mappingById: MappingById,
  latest: Record<string, WikiLatestEntry>,
  hourly: Record<string, WikiHourlyEntry>
) {
  const items: MerchantItem[] = [];
  const nowSeconds = Math.floor(Date.now() / 1000);

  for (const [idValue, latestEntry] of Object.entries(latest)) {
    const id = Number(idValue);
    if (!Number.isFinite(id)) continue;

    const mapping = mappingById[id];
    const buy = latestEntry?.low ?? 0;
    const sell = latestEntry?.high ?? 0;

    if (!mapping || buy <= 0 || sell <= 0) continue;

    const tax = calculateTax(sell);
    const profit = sell - buy - tax;
    if (profit <= 0) continue;
    if (profit < 25) continue;

    const volumeEntry = hourly[idValue];
    const volume =
      (volumeEntry?.lowPriceVolume ?? 0) + (volumeEntry?.highPriceVolume ?? 0);
    if (volume < 5) continue;

    const highTime = latestEntry?.highTime ?? 0;
    const lowTime = latestEntry?.lowTime ?? 0;
    const newestTradeTime = Math.max(highTime, lowTime);
    const oldestTradeTime = Math.min(highTime || newestTradeTime, lowTime || newestTradeTime);
    if (newestTradeTime <= 0) continue;

    const lastTradeAgeMinutes = (nowSeconds - newestTradeTime) / 60;
    const staleSideAgeMinutes = (nowSeconds - oldestTradeTime) / 60;
    if (!Number.isFinite(lastTradeAgeMinutes) || lastTradeAgeMinutes > 180) continue;
    if (!Number.isFinite(staleSideAgeMinutes) || staleSideAgeMinutes > 360) continue;

    const roi = (profit / buy) * 100;
    const limit = mapping.limit;
    const limitProfit = limit > 0 ? profit * limit : 0;
    const avgMarketPrice =
      ((volumeEntry?.avgHighPrice ?? sell) + (volumeEntry?.avgLowPrice ?? buy)) / 2;
    const spreadPct = avgMarketPrice > 0 ? (profit / avgMarketPrice) * 100 : roi;
    const boundedFillRatio = limit > 0 ? clamp(volume / limit, 0, 1.2) : clamp(volume / 200, 0, 1);
    const volumeDepth = clamp(Math.log10(volume + 1) / 4.2, 0, 1);
    const freshnessScore =
      clamp(1 - lastTradeAgeMinutes / 180, 0, 1) * 0.7 +
      clamp(1 - staleSideAgeMinutes / 360, 0, 1) * 0.3;
    const spreadSanity = clamp(1 - Math.max(spreadPct - 12, 0) / 38, 0, 1);
    const boundedRoi = clamp(roi, 0, 20) / 20;
    const boundedProfit = clamp(Math.log10(profit + 1) / 3.6, 0, 1);
    const boundedLimitProfit = clamp(Math.log10(limitProfit + profit + 1) / 6.2, 0, 1);

    const confidence = clamp(
      Math.round(
      (
        volumeDepth * 0.35 +
        boundedFillRatio * 0.2 +
        freshnessScore * 0.3 +
        spreadSanity * 0.15
      ) * 100
      ),
      0,
      100
    );

    let signal: MerchantSignal = "Wait";
    if (confidence >= 72 && volume >= 20 && profit >= 300 && lastTradeAgeMinutes <= 45) {
      signal = "Flip";
    } else if (confidence >= 55 && volume >= 5 && profit >= 150 && lastTradeAgeMinutes <= 90) {
      signal = "Caution";
    }

    const score = Number(
      (
        (boundedProfit * 32 +
          boundedLimitProfit * 14 +
          boundedRoi * 14 +
          volumeDepth * 18 +
          boundedFillRatio * 10 +
          freshnessScore * 22) *
        (confidence / 100)
      ).toFixed(2)
    );

    items.push({
      id,
      name: mapping.name,
      members: mapping.members,
      limit,
      buy,
      sell,
      tax,
      profit,
      roi: Number(roi.toFixed(2)),
      volume,
      limitProfit,
      lastTradeAgeMinutes: Math.round(lastTradeAgeMinutes),
      staleSideAgeMinutes: Math.round(staleSideAgeMinutes),
      confidence,
      signal,
      score,
    });
  }

  items.sort((left, right) => right.score - left.score);
  return items;
}

async function refreshCache() {
  const now = Date.now();
  if (cache.cachedAt && now - cache.cachedAt < DATA_TTL_MS && cache.items.length > 0) {
    return cache;
  }

  try {
    const [mappingById, latestPayload, hourlyPayload] = await Promise.all([
      loadMapping(),
      fetchJson<{ data: Record<string, WikiLatestEntry> }>(LATEST_URL, 60),
      fetchJson<{ data: Record<string, WikiHourlyEntry> }>(HOURLY_URL, 60),
    ]);

    cache.items = buildMerchantItems(
      mappingById,
      latestPayload.data ?? {},
      hourlyPayload.data ?? {}
    );
    cache.cachedAt = now;
  } catch (error) {
    console.error("[merchant-prices] Failed to refresh prices", error);
    if (!cache.cachedAt || cache.items.length === 0) {
      throw error;
    }
  }

  return cache;
}

export async function GET() {
  try {
    const data = await refreshCache();

    return NextResponse.json(
      {
        cachedAt: data.cachedAt,
        count: data.items.length,
        items: data.items,
        note: "Cached merchant utility data for the built-in GE flip panel.",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to load merchant price data." },
      { status: 502 }
    );
  }
}
