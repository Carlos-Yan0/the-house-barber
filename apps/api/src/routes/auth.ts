// src/routes/auth.ts
import Elysia, { t } from "elysia";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "../lib/prisma";
import { getUserFromHeader, type AuthUser } from "../lib/getUser";
import { sendPasswordResetEmail } from "../services/email.service";
import { checkRateLimit, LIMITS } from "../lib/Ratelimit";

// ── Shared Zod schemas ────────────────────────────────────────────────────────
const emailSchema    = z.string().email("E-mail inválido").toLowerCase().trim();
const passwordSchema = z.string().min(8, "Senha deve ter mínimo 8 caracteres").max(128, "Senha muito longa");
const nameSchema     = z.string().min(2, "Nome muito curto").max(100, "Nome muito longo").trim();

const registerSchema = z.object({
  name:     nameSchema,
  email:    emailSchema,
  phone:    z.string().max(20).optional(),
  password: passwordSchema,
});

const loginSchema = z.object({
  email:    emailSchema,
  password: z.string().min(1).max(128),
});

const forgotSchema = z.object({ email: emailSchema });

const resetSchema = z.object({
  token:    z.string().length(64).regex(/^[a-f0-9]+$/, "Token inválido"),
  password: passwordSchema,
});

function getIp(headers: Record<string, string | undefined>): string {
  return (headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? headers["x-real-ip"]
    ?? "unknown";
}

function toAuthResponseUser(
  user: Pick<AuthUser, "id" | "name" | "email" | "phone" | "avatarUrl" | "role" | "barberProfile">
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    role: user.role,
    barberProfileId: user.barberProfile?.id ?? null,
    barberProfile: user.barberProfile
      ? {
          id: user.barberProfile.id,
          commissionRate: user.barberProfile.commissionRate,
          isAvailable: user.barberProfile.isAvailable,
        }
      : null,
  };
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwt({ name: "jwt",        secret: process.env.JWT_SECRET        ?? "fallback-secret-change-me" }))
  .use(jwt({ name: "refreshJwt", secret: process.env.JWT_REFRESH_SECRET ?? "fallback-refresh-secret-change-me" }))

  // ── POST /auth/register ───────────────────────────────────────────────────
  .post("/register", async ({ body, jwt, headers, set }) => {
    const ip = getIp(headers as any);
    if (!checkRateLimit(`register:${ip}`, LIMITS.REGISTER.limit, LIMITS.REGISTER.windowMs)) {
      set.status = 429; return { error: "Muitas tentativas. Aguarde alguns minutos." };
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) { set.status = 422; return { error: parsed.error.flatten() }; }

    const { name, email, phone, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { set.status = 409; return { error: "E-mail já cadastrado" }; }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash, role: "CLIENT" },
      select: { id: true, name: true, email: true, role: true },
    });

    const token = await jwt.sign({ sub: user.id, role: user.role, name: user.name });
    set.status = 201;
    return { user, token };
  }, {
    body: t.Object({ name: t.String(), email: t.String(), phone: t.Optional(t.String()), password: t.String() }),
    detail: { tags: ["Auth"], summary: "Criar nova conta" },
  })

  // ── POST /auth/login ──────────────────────────────────────────────────────
  .post("/login", async ({ body, jwt, refreshJwt, headers, set }) => {
    const ip = getIp(headers as any);
    if (!checkRateLimit(`login:${ip}`, LIMITS.LOGIN.limit, LIMITS.LOGIN.windowMs)) {
      set.status = 429; return { error: "Muitas tentativas. Aguarde alguns minutos." };
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) { set.status = 422; return { error: parsed.error.flatten() }; }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        role: true,
        passwordHash: true,
        barberProfile: {
          select: {
            id: true,
            userId: true,
            commissionRate: true,
            isAvailable: true,
          },
        },
      },
    });

    // Constant-time comparison even when user not found → prevents timing attacks
    const hashToCheck = user?.passwordHash ?? "$2a$12$dummyhashtopreventtimingattackxx";
    const validPassword = await bcrypt.compare(password, hashToCheck);

    if (!user || !validPassword) { set.status = 401; return { error: "Credenciais inválidas" }; }

    const token = await jwt.sign({ sub: user.id, role: user.role, name: user.name });
    const refreshToken = await refreshJwt.sign({ sub: user.id, jti: crypto.randomUUID() });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });

    return {
      token, refreshToken,
      user: toAuthResponseUser(user),
    };
  }, {
    body: t.Object({ email: t.String(), password: t.String() }),
    detail: { tags: ["Auth"], summary: "Fazer login" },
  })

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  .post("/refresh", async ({ body, jwt, refreshJwt, set }) => {
    const { refreshToken } = body as { refreshToken: string };
    if (!refreshToken || typeof refreshToken !== "string") {
      set.status = 400; return { error: "Refresh token obrigatório" };
    }

    const payload = await refreshJwt.verify(refreshToken);
    if (!payload) { set.status = 401; return { error: "Refresh token inválido" }; }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
    if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
      set.status = 401; return { error: "Refresh token expirado ou inválido" };
    }

    const newToken = await jwt.sign({ sub: stored.user.id, role: stored.user.role, name: stored.user.name });
    return { token: newToken };
  }, {
    body: t.Object({ refreshToken: t.String() }),
    detail: { tags: ["Auth"], summary: "Renovar token de acesso" },
  })

  // ── POST /auth/logout ─────────────────────────────────────────────────────
  .post("/logout", async ({ body }) => {
    const { refreshToken } = body as { refreshToken: string };
    if (refreshToken) await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return { message: "Logout realizado com sucesso" };
  }, {
    body: t.Object({ refreshToken: t.String() }),
    detail: { tags: ["Auth"], summary: "Fazer logout" },
  })

  // ── GET /auth/me ──────────────────────────────────────────────────────────
  .get("/me", async ({ headers, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) {
      set.status = auth.status;
      return { error: auth.error };
    }

    return toAuthResponseUser(auth.user);
  }, { detail: { tags: ["Auth"], summary: "Obter dados do usuário autenticado" } })

  // ── POST /auth/forgot-password ────────────────────────────────────────────
  .post("/forgot-password", async ({ body, headers, set }) => {
    const ip = getIp(headers as any);
    if (!checkRateLimit(`forgot:${ip}`, LIMITS.FORGOT_PASSWORD.limit, LIMITS.FORGOT_PASSWORD.windowMs)) {
      set.status = 429; return { error: "Muitas tentativas. Aguarde alguns minutos." };
    }

    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) { set.status = 422; return { error: parsed.error.flatten() }; }

    const { email } = parsed.data;
    const GENERIC = { message: "Se este e-mail estiver cadastrado, você receberá as instruções em breve." };

    const user = await prisma.user.findUnique({
      where: { email, isActive: true },
      select: { id: true, name: true, email: true },
    });

    if (!user) return GENERIC;

    // Secondary rate limit by email to prevent targeting specific accounts
    if (!checkRateLimit(`forgot:email:${email}`, 3, 60 * 60 * 1000)) return GENERIC;

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

    sendPasswordResetEmail(user.email, user.name, token).catch((err) =>
      console.error("[forgot-password] Erro ao enviar e-mail:", err)
    );

    return GENERIC;
  }, {
    body: t.Object({ email: t.String() }),
    detail: { tags: ["Auth"], summary: "Solicitar redefinição de senha" },
  })

  // ── POST /auth/reset-password ─────────────────────────────────────────────
  .post("/reset-password", async ({ body, headers, set }) => {
    const ip = getIp(headers as any);
    if (!checkRateLimit(`reset:${ip}`, LIMITS.RESET_PASSWORD.limit, LIMITS.RESET_PASSWORD.windowMs)) {
      set.status = 429; return { error: "Muitas tentativas. Aguarde alguns minutos." };
    }

    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) { set.status = 422; return { error: parsed.error.flatten() }; }

    const { token, password } = parsed.data;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, isActive: true } } },
    });

    if (!resetToken)                       { set.status = 400; return { error: "Token inválido ou expirado" }; }
    if (resetToken.usedAt)                 { set.status = 400; return { error: "Este link já foi utilizado. Solicite um novo." }; }
    if (resetToken.expiresAt < new Date()) { set.status = 400; return { error: "Token expirado. Solicite um novo link." }; }
    if (!resetToken.user.isActive)         { set.status = 400; return { error: "Conta inativa. Entre em contato com o suporte." }; }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.deleteMany({ where: { userId: resetToken.userId } }),
    ]);

    return { message: "Senha redefinida com sucesso! Faça login com a nova senha." };
  }, {
    body: t.Object({ token: t.String(), password: t.String() }),
    detail: { tags: ["Auth"], summary: "Redefinir senha com token" },
  });
