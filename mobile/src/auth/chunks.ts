// The sign-in session lives in the iPhone Keychain (expo-secure-store),
// never in plain storage. The Keychain is meant for small values (Expo
// warns above 2048 bytes) and a Supabase session is often larger, so it is
// stored in numbered pieces: "<key>.n" holds how many, "<key>.0".. the
// pieces. Pure helpers, tested in tests/chunks.test.ts.
export const CHUNK_SIZE = 1800;
export const MAX_CHUNKS = 32;

export function splitValue(value: string, size = CHUNK_SIZE): string[] {
  if (value.length === 0) return [""];
  const out: string[] = [];
  for (let i = 0; i < value.length; i += size) out.push(value.slice(i, i + size));
  return out;
}

export function countKey(key: string): string {
  return `${key}.n`;
}

export function pieceKey(key: string, i: number): string {
  return `${key}.${i}`;
}

// The stored count, or null when it is missing or not a sane number.
export function parseCount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= MAX_CHUNKS ? n : null;
}

export type KV = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

// A storage adapter for supabase-js over any small-value store.
export function chunkedStorage(kv: KV) {
  return {
    async getItem(key: string): Promise<string | null> {
      const n = parseCount(await kv.get(countKey(key)));
      if (n === null) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const p = await kv.get(pieceKey(key, i));
        if (p === null) return null; // a torn write reads as signed out
        parts.push(p);
      }
      return parts.join("");
    },
    async setItem(key: string, value: string): Promise<void> {
      const parts = splitValue(value);
      if (parts.length > MAX_CHUNKS) throw new Error("session too large to store");
      const old = parseCount(await kv.get(countKey(key))) ?? 0;
      for (let i = 0; i < parts.length; i++) await kv.set(pieceKey(key, i), parts[i]);
      await kv.set(countKey(key), String(parts.length));
      for (let i = parts.length; i < old; i++) await kv.remove(pieceKey(key, i));
    },
    async removeItem(key: string): Promise<void> {
      const n = parseCount(await kv.get(countKey(key))) ?? 0;
      await kv.remove(countKey(key));
      for (let i = 0; i < n; i++) await kv.remove(pieceKey(key, i));
    },
  };
}
