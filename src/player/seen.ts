const KEY = "mmvp_seen_content_ids_v1";

export function getSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function markSeen(id: string) {
  if (typeof window === "undefined") return;
  const seen = Array.from(getSeen());
  if (!seen.includes(id)) seen.push(id);
  localStorage.setItem(KEY, JSON.stringify(seen.slice(-5000)));
}
