// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { __resetWomCacheForTests, GET } from "@/app/api/player/[rsn]/route.ts";

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("api/player/[rsn]", () => {
  beforeEach(() => {
    __resetWomCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns normalized skills and bosses from Wise Old Man data", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          displayName: "Display Name",
          latestSnapshot: {
            data: {
              skills: {
                attack: { level: 55 },
                strength: { level: 70 },
              },
              bosses: {
                vorkath: { kills: 12 },
              },
            },
          },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = GET(
      undefined as unknown as NextRequest,
      { params: Promise.resolve({ rsn: "Display Name" }) }
    );

    await vi.advanceTimersByTimeAsync(1_200);
    const response = await responsePromise;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rsn).toBe("Display Name");
    expect(body.skills.attack).toBe(55);
    expect(body.skills.strength).toBe(70);
    expect(body.skills.sailing).toBe(1);
    expect(body.bosses.vorkath).toBe(12);
    expect(body.bosses.zulrah).toBe(0);
    expect(body.meta).toMatchObject({
      source: "live",
      stale: false,
      refreshed: true,
      warning: null,
      warningCode: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ cache: "no-store" });
  });

  it("serves a hot cache hit without refetching upstream data", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          displayName: "Cache Hero",
          latestSnapshot: {
            data: {
              skills: { attack: { level: 40 } },
              bosses: { vorkath: { kills: 4 } },
            },
          },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const firstResponsePromise = GET(
      undefined as unknown as NextRequest,
      { params: Promise.resolve({ rsn: "Cache Hero" }) }
    );
    await vi.advanceTimersByTimeAsync(1_200);
    await firstResponsePromise;

    const secondResponse = await GET(
      undefined as unknown as NextRequest,
      { params: Promise.resolve({ rsn: "Cache Hero" }) }
    );
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondBody.meta).toMatchObject({
      source: "cache",
      stale: false,
      refreshed: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates in-flight requests for the same RSN", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          displayName: "Shared Hero",
          latestSnapshot: {
            data: {
              skills: { attack: { level: 75 } },
              bosses: { zulrah: { kills: 9 } },
            },
          },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const firstPromise = GET(
      undefined as unknown as NextRequest,
      { params: Promise.resolve({ rsn: "Shared Hero" }) }
    );
    const secondPromise = GET(
      undefined as unknown as NextRequest,
      { params: Promise.resolve({ rsn: "Shared Hero" }) }
    );

    await vi.advanceTimersByTimeAsync(1_200);
    const [firstResponse, secondResponse] = await Promise.all([firstPromise, secondPromise]);
    const [firstBody, secondBody] = await Promise.all([firstResponse.json(), secondResponse.json()]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstBody.skills.attack).toBe(75);
    expect(secondBody.bosses.zulrah).toBe(9);
  });

  it("falls back to a stale cache entry when a live refetch fails", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          displayName: "Fallback Hero",
          latestSnapshot: {
            data: {
              skills: { attack: { level: 88 } },
              bosses: { vorkath: { kills: 20 } },
            },
          },
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    vi.stubGlobal("fetch", fetchMock);

    const firstResponsePromise = GET(
      undefined as unknown as NextRequest,
      { params: Promise.resolve({ rsn: "Fallback Hero" }) }
    );
    await vi.advanceTimersByTimeAsync(1_200);
    await firstResponsePromise;

    await vi.advanceTimersByTimeAsync(16_000);

    const secondResponsePromise = GET(
      undefined as unknown as NextRequest,
      { params: Promise.resolve({ rsn: "Fallback Hero" }) }
    );
    await vi.advanceTimersByTimeAsync(1_200);
    const secondResponse = await secondResponsePromise;
    const secondBody = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondBody.rsn).toBe("Fallback Hero");
    expect(secondBody.skills.attack).toBe(88);
    expect(secondBody.meta).toMatchObject({
      source: "cache",
      stale: true,
      refreshed: false,
      warningCode: "WOM_BAD_RESPONSE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("returns a structured 404 when Wise Old Man has no snapshot yet", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        makeJsonResponse({
          displayName: "Fresh Player",
          latestSnapshot: null,
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const responsePromise = GET(
      undefined as unknown as NextRequest,
      { params: Promise.resolve({ rsn: "Fresh Player" }) }
    );

    await vi.advanceTimersByTimeAsync(1_200);
    const response = await responsePromise;

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Player snapshot not available yet. Try again in a few seconds.",
      code: "WOM_SNAPSHOT_PENDING",
      retryable: true,
    });
  });
});
