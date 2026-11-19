import * as Crypto from 'expo-crypto';

export const newId = () => Crypto.randomUUID();

/**
 * Stable UUID from a string (sha256, shaped as a v5-style UUID). The same seed always gives the
 * same id, so re-running an upload or a migration never duplicates rows.
 */
export async function stableUuid(seed: string): Promise<string> {
  const h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Seed prefix for activities converted from pre-v3 logs (matches the first upload's ids). */
export const legacyUuid = (petId: string) => (seed: string) => stableUuid(`petapp:${petId}:${seed}`);
