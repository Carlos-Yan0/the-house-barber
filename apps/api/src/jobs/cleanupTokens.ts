// src/jobs/cleanupTokens.ts
// Cronjob que remove tokens expirados das tabelas `refresh_tokens`
// e `password_reset_tokens`.
//
// Sem limpeza periódica, em 6 meses com 50 usuários ativos acumulam-se
// ~1.500 refresh tokens e centenas de reset tokens mortos — tornando
// queries na tabela progressivamente mais lentas.

import { prisma } from "../lib/prisma";

const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas

async function cleanupExpiredTokens() {
  try {
    const [refresh, reset] = await Promise.all([
      // Refresh tokens expirados
      prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      }),
      // Reset tokens expirados OU já utilizados há mais de 24h
      prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { usedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          ],
        },
      }),
    ]);

    if (refresh.count > 0 || reset.count > 0) {
      console.log(
        `[cleanup] Removidos ${refresh.count} refresh token(s) + ${reset.count} reset token(s) expirados`
      );
    }
  } catch (err) {
    console.error("[cleanup] Erro ao remover tokens expirados:", err);
  }
}

export function startTokenCleanupJob() {
  cleanupExpiredTokens();
  const timer = setInterval(cleanupExpiredTokens, INTERVAL_MS);
  timer.unref();
  console.log(`[cleanup] Job iniciado — executa a cada ${INTERVAL_MS / 3_600_000}h`);
}