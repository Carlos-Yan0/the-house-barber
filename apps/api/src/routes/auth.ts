// src/routes/auth.ts
import Elysia, { t } from "elysia";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../lib/prisma";

const registerSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  password: z.string().min(8, "Senha deve ter mínimo 8 caracteres"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET ?? "fallback-secret-change-me",
    })
  )
  .use(
    jwt({
      name: "refreshJwt",
      secret: process.env.JWT_REFRESH_SECRET ?? "fallback-refresh-secret-change-me",
    })
  )

  // POST /auth/register
  .post(
    "/register",
    async ({ body, jwt, set }) => {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 422;
        return { error: parsed.error.flatten() };
      }

      const { name, email, phone, password } = parsed.data;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        set.status = 409;
        return { error: "E-mail já cadastrado" };
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: { name, email, phone, passwordHash, role: "CLIENT" },
        select: { id: true, name: true, email: true, role: true },
      });

      const token = await jwt.sign({
        sub: user.id,
        role: user.role,
        name: user.name,
      });

      set.status = 201;
      return { user, token };
    },
    {
      body: t.Object({
        name: t.String(),
        email: t.String(),
        phone: t.Optional(t.String()),
        password: t.String(),
      }),
      detail: { tags: ["Auth"], summary: "Criar nova conta" },
    }
  )

  // POST /auth/login
  .post(
    "/login",
    async ({ body, jwt, refreshJwt, set }) => {
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 422;
        return { error: parsed.error.flatten() };
      }

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({
        where: { email, isActive: true },
        include: { barberProfile: { select: { id: true, isAvailable: true } } },
      });

      if (!user) {
        set.status = 401;
        return { error: "Credenciais inválidas" };
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        set.status = 401;
        return { error: "Credenciais inválidas" };
      }

      const token = await jwt.sign({
        sub: user.id,
        role: user.role,
        name: user.name,
      });

      const refreshToken = await refreshJwt.sign({ sub: user.id });

      // Save refresh token
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await prisma.refreshToken.create({
        data: { userId: user.id, token: refreshToken, expiresAt },
      });

      return {
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          barberProfileId: user.barberProfile?.id ?? null,
          barberProfile: user.barberProfile
            ? { id: user.barberProfile.id, isAvailable: user.barberProfile.isAvailable }
            : null,
        },
      };
    },
    {
      body: t.Object({ email: t.String(), password: t.String() }),
      detail: { tags: ["Auth"], summary: "Fazer login" },
    }
  )

  // POST /auth/refresh
  .post(
    "/refresh",
    async ({ body, jwt, refreshJwt, set }) => {
      const { refreshToken } = body as { refreshToken: string };

      const payload = await refreshJwt.verify(refreshToken);
      if (!payload) {
        set.status = 401;
        return { error: "Refresh token inválido" };
      }

      const stored = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
        set.status = 401;
        return { error: "Refresh token expirado ou inválido" };
      }

      const newToken = await jwt.sign({
        sub: stored.user.id,
        role: stored.user.role,
        name: stored.user.name,
      });

      return { token: newToken };
    },
    {
      body: t.Object({ refreshToken: t.String() }),
      detail: { tags: ["Auth"], summary: "Renovar token de acesso" },
    }
  )

  // POST /auth/logout
  .post(
    "/logout",
    async ({ body }) => {
      const { refreshToken } = body as { refreshToken: string };
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
      return { message: "Logout realizado com sucesso" };
    },
    {
      body: t.Object({ refreshToken: t.String() }),
      detail: { tags: ["Auth"], summary: "Fazer logout" },
    }
  )

  // GET /auth/me
  .get(
    "/me",
    async ({ headers, jwt, set }) => {
      const authHeader = headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        set.status = 401;
        return { error: "Token não fornecido" };
      }

      const token = authHeader.slice(7);
      const payload = await jwt.verify(token);
      if (!payload) {
        set.status = 401;
        return { error: "Token inválido" };
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub as string },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          avatarUrl: true,
          barberProfile: {
            select: { id: true, commissionRate: true, isAvailable: true },
          },
        },
      });

      if (!user) {
        set.status = 404;
        return { error: "Usuário não encontrado" };
      }

      return user;
    },
    { detail: { tags: ["Auth"], summary: "Obter dados do usuário autenticado" } }
  );
