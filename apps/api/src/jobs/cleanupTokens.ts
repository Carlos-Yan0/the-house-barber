// src/jobs/cleanupTokens.ts
// Cronjob que remove refresh tokens expirados da tabela `refresh_tokens`.
//
// Problema: tokens expirados nunca são deletados automaticamente.
// Com 50 usuários ativos e refresh a cada 7 dias, em 6 meses acumulam
// ~1.500 linhas mortas. Queries na tabela ficam progressivamente mais lentas
// porque o Postgres precisa varrer registros inúteis.
//
// Solução: rodar DELETE WHERE expiresAt < NOW() periodicamente.
// Frequência escolhida: a cada 6 horas — agressivo o suficiente para manter
// a tabela pequena sem pressionar o banco free do Supabase.

import { prisma } from "../lib/prisma";

const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 horas

async function cleanupExpiredTokens() {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    if (result.count > 0) {
      console.log(`[cleanup] Removidos ${result.count} refresh token(s) expirado(s)`);
    }
  } catch (err) {
    // Loga mas não derruba o processo — falha de cleanup é não-crítica.
    console.error("[cleanup] Erro ao remover tokens expirados:", err);
  }
}

/**
 * Inicia o cronjob de limpeza de tokens.
 * Deve ser chamado uma única vez no bootstrap da aplicação (src/index.ts).
 *
 * - Roda imediatamente ao iniciar (limpa qualquer acúmulo do deploy anterior)
 * - Depois roda a cada INTERVAL_MS
 */
export function startTokenCleanupJob() {
  // Primeira execução imediata — sem esperar o primeiro intervalo.
  cleanupExpiredTokens();

  const timer = setInterval(cleanupExpiredTokens, INTERVAL_MS);

  // Permite que o processo encerre graciosamente sem travar no timer.
  // Necessário para testes e reloads do bun --watch.
  timer.unref();

  console.log(`[cleanup] Job iniciado — executa a cada ${INTERVAL_MS / 3_600_000}h`);
}