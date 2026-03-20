// src/middlewares/auth.ts
import Elysia from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../lib/prisma";

// Shared JWT plugin — used directly in route files too
export const jwtConfig = {
  name: "jwt" as const,
  secret: process.env.JWT_SECRET ?? "fallback-secret-change-me-in-production",
};

export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .use(jwt(jwtConfig))
  .derive(async ({ jwt, headers, set }) => {
    const authHeader = headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      set.status = 401;
      throw new Error("Token não fornecido");
    }

    const token = authHeader.slice(7);
    const payload = await jwt.verify(token);

    if (!payload) {
      set.status = 401;
      throw new Error("Token inválido ou expirado");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string, isActive: true },
      include: {
        barberProfile: {
          select: { id: true, commissionRate: true, isAvailable: true, userId: true },
        },
      },
    });

    if (!user) {
      set.status = 401;
      throw new Error("Usuário não encontrado");
    }

    return {
      currentUser: user,
      userId: user.id,
      userRole: user.role as string,
    };
  });