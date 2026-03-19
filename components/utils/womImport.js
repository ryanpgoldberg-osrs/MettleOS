export async function fetchPlayerSnapshotByRsn(rsn) {
  const trimmed = typeof rsn === "string" ? rsn.trim() : "";
  if (!trimmed) {
    throw new Error("An RSN is required to fetch Wise Old Man data.");
  }

  const res = await fetch(`/api/player/${encodeURIComponent(trimmed)}`, {
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" && data.error.trim()
        ? data.error
        : `Wise Old Man returned ${res.status}.`
    );
  }
  if (!data || typeof data !== "object") {
    throw new Error("Wise Old Man returned an invalid response.");
  }

  return data;
}
