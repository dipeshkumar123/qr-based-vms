import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison that doesn't leak string length.
 * Both values are SHA-256 hashed first so they are always the same length,
 * preventing timing side-channels from length differences.
 */
export function safeCompare(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
