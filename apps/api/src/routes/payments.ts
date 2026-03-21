// src/routes/payments.ts
import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { getPaymentStatus } from "../services/mercadopago.service";

export const paymentRoutes = new Elysia({ prefix: "/payments" })

  // ── GET /payments/pix/status/:appointmentId ───────────────────────────────
  // Frontend faz polling para saber se o PIX foi pago
  .get("/pix/status/:appointmentId", async ({ params, set }) => {
    const comanda = await prisma.comanda.findFirst({
      where: { appointmentId: params.appointmentId },
      select: { paymentStatus: true, pixTxId: true, status: true },
    });

    if (!comanda) {
      set.status = 404;
      return { error: "Comanda não encontrada" };
    }

    // Se já está marcado como pago no banco, retorna direto
    if (comanda.paymentStatus === "PAID") {
      return { status: "approved", paid: true };
    }

    // Se tem ID do MP, verifica status atual
    if (comanda.pixTxId) {
      try {
        const mpStatus = await getPaymentStatus(Number(comanda.pixTxId));
        const paid = mpStatus === "approved";

        if (paid) {
          await confirmPixPayment(params.appointmentId, comanda.pixTxId);
        }

        return { status: mpStatus, paid };
      } catch {
        return { status: "pending", paid: false };
      }
    }

    return { status: "pending", paid: false };
  })

  // ── POST /payments/webhook ─────────────────────────────────────────────────
  // Webhook do Mercado Pago notifica quando pagamento muda de status
  .post(
    "/webhook",
    async ({ body, headers, set }) => {
      const secret = process.env.MP_WEBHOOK_SECRET;
      if (secret) {
        const signature = headers["x-signature"] as string | undefined;
        if (!signature) {
          console.warn("[Webhook] Requisição sem x-signature");
        }
      }

      const payload = body as any;

      if (payload?.action !== "payment.updated" || !payload?.data?.id) {
        return { received: true };
      }

      const mpPaymentId = String(payload.data.id);

      try {
        const mpStatus = await getPaymentStatus(Number(mpPaymentId));

        if (mpStatus === "approved") {
          const comanda = await prisma.comanda.findFirst({
            where: { pixTxId: mpPaymentId },
            include: { appointment: true },
          });

          if (comanda && comanda.paymentStatus !== "PAID") {
            await confirmPixPayment(comanda.appointmentId, mpPaymentId);
            console.log(`[Webhook] PIX aprovado — comanda ${comanda.id}`);
          }
        }
      } catch (err) {
        console.error("[Webhook] Erro ao processar:", err);
      }

      return { received: true };
    },
    { body: t.Any() }
  );

// ── Função auxiliar: confirma pagamento PIX e cria comissão ──────────────────
async function confirmPixPayment(appointmentId: string, pixTxId: string) {
  const comanda = await prisma.comanda.findFirst({
    where: { appointmentId },
    include: {
      appointment: {
        include: {
          barberProfile: true,
        },
      },
    },
  });

  if (!comanda || comanda.paymentStatus === "PAID") return;

  // Fecha comanda, confirma agendamento e cria comissão numa transação
  await prisma.$transaction([
    prisma.comanda.update({
      where: { id: comanda.id },
      data: {
        paymentStatus: "PAID",
        paymentMethod: "PIX",
        status: "CLOSED",
        paidAt: new Date(),
        closedAt: new Date(),
      },
    }),
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CONFIRMED" },
    }),
  ]);

  // Cria comissão do barbeiro (upsert evita duplicata)
  const bp = comanda.appointment.barberProfile;
  await prisma.commission.upsert({
    where: { comandaId: comanda.id },
    create: {
      barberProfileId: bp.id,
      comandaId: comanda.id,
      grossAmount: comanda.totalAmount,
      commissionRate: bp.commissionRate,
      commissionAmount: Number(comanda.totalAmount) * bp.commissionRate,
    },
    update: {},
  });
}