// src/lib/getUser.ts
// Utility to extract authenticated user directly from Authorization header
// Bypasses Elysia derive chain issues in 1.1.x

import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET ?? "fallback-secret-change-me";

// Minimal JWT verify without external lib (Bun has built-in crypto)
async function verifyJWT(token: string): Promise<{ sub: string; role: string; name: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    // Verify signature using Bun's crypto
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sig = Uint8Array.from(
      atob(signature.replace(/-/g, "+").replace(/_/g, "/").padEnd(signature.length + (4 - (signature.length % 4)) % 4, "=")),
      (c) => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(data));
    if (!valid) return null;

    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));

    // Check expiry
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
  barberProfile?: { id: string; commissionRate: number; isAvailable: boolean; userId: string } | null;
}

export async function getUserFromHeader(
  authHeader: string | undefined
): Promise<{ user: AuthUser; error: null } | { user: null; error: string; status: number }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { user: null, error: "Token não fornecido", status: 401 };
  }

  const token = authHeader.slice(7);
  const payload = await verifyJWT(token);

  if (!payload) {
    return { user: null, error: "Token inválido ou expirado", status: 401 };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub, isActive: true },
    select: {
      id: true, name: true, role: true,
      barberProfile: {
        select: { id: true, commissionRate: true, isAvailable: true, userId: true },
      },
    },
  });

  if (!user) {
    return { user: null, error: "Usuário não encontrado", status: 401 };
  }

  return { user, error: null };
}