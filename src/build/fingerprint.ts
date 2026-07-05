import crypto from "node:crypto";

/**
 * Short content hash for cache-busting: the first 8 hex chars of the SHA-256 of
 * the asset's bytes. Deterministic — identical input always yields the identical
 * hash, so an unchanged asset keeps its URL across rebuilds, and any change
 * mints a fresh URL that no browser or edge cache has ever seen.
 */
export function contentHash(buf: Buffer | string): string {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
}

/**
 * Insert a content hash before the final extension:
 * `fingerprintName("site.js", "a1b2c3d4")` → `"site.a1b2c3d4.js"`.
 * Files without an extension get the hash appended: `"LICENSE"` → `"LICENSE.a1b2c3d4"`.
 */
export function fingerprintName(name: string, hash: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name}.${hash}`;
  return `${name.slice(0, dot)}.${hash}${name.slice(dot)}`;
}
