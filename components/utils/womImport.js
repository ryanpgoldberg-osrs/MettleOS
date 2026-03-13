export async function fetchPlayerSnapshotByRsn(rsn) {
  const trimmed = typeof rsn === "string" ? rsn.trim() : "";
  if (!trimmed) {
    throw new Error("An RSN is required to fetch Wise Old Man data.");
  }

  const res = await fetch(`/api/player/${encodeURIComponent(trimmed)}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Wise Old Man returned ${res.status}.`);
  }

  const data = await res.json();
  if (!data || typeof data !== "object") {
    throw new Error("Wise Old Man returned an invalid response.");
  }

  return data;
}
