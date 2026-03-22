// src/lib/getUser.ts
// Utility to extract authenticated user directly from Authorization header.
// Bypasses Elysia derive chain issues in 1.1.x.
//
// OPTIMISATION: results are cached in memory for CACHE_TTL_MS.
// A busy barber dashboard hitting 10 endpoints/min was firing 10 DB
// SELECT queries for the exact same user row — now it fires one per TTL window.

import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback-secret-change-me";

// ── In-memory token cache ────────────────────────────────────────────────────
// Keyed by raw Bearer token so we never confuse different users.
// TTL is intentionally short (30 s) — if the user is deactivated mid-session
// the change propagates within half a minute.
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  result: { user: AuthUser; error: null } | { user: null; error: string; status: number };
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

// Prune expired entries to prevent unbounded growth (runs lazily on every miss).
function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of _cache) {
    if (entry.expiresAt <= now) _cache.delete(key);
  }
}

// ── Minimal JWT verify (no external lib, uses Bun built-in crypto) ───────────
async function verifyJWT(
  token: string
): Promise<{ sub: string; role: string; name: string; exp?: number } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sig = Uint8Array.from(
      atob(
        signature
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(signature.length + (4 - (signature.length % 4)) % 4, "=")
      ),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sig,
      new TextEncoder().encode(data)
    );
    if (!valid) return null;

    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));

    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return decoded;
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  barberProfile?: {
    id: string;
    commissionRate: number;
    isAvailable: boolean;
    userId: string;
  } | null;
}

export async function getUserFromHeader(
  authHeader: string | undefined
): Promise<
  | { user: AuthUser; error: null }
  | { user: null; error: string; status: number }
> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "Token não fornecido", status: 401 };
  }

  const token = authHeader.slice(7);

  // ── Cache hit ────────────────────────────────────────────────────────────
  const cached = _cache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // Cache miss — prune stale entries then do the DB round-trip.
  pruneCache();

  const payload = await verifyJWT(token);
  if (!payload) {
    // Don't cache invalid tokens — they're either expired or forged.
    return { user: null, error: "Token inválido ou expirado", status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub, isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
      barberProfile: {
        select: {
          id: true,
          commissionRate: true,
          isAvailable: true,
          userId: true,
        },
      },
    },
  });

  const result: CacheEntry["result"] = user
    ? { user, error: null }
    : { user: null, error: "Usuário não encontrado", status: 401 };

  // Cache successful lookups only. TTL is capped at the token's remaining
  // lifetime so we never return a cached result after the JWT has expired.
  if (result.user && payload.exp) {
    const jwtExpiresAt = payload.exp * 1000;
    const ttlBasedExpiry = Date.now() + CACHE_TTL_MS;
    _cache.set(token, {
      result,
      expiresAt: Math.min(jwtExpiresAt, ttlBasedExpiry),
    });
  }

  return result;
}

/**
 * Call this when a user's data changes (role change, deactivation, etc.)
 * to immediately invalidate any cached session for that user.
 */
export function invalidateUserCache(userId: string) {
  for (const [token, entry] of _cache) {
    if (entry.result.user?.id === userId) {
      _cache.delete(token);
    }
  }
}