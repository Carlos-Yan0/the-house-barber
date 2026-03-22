// src/routes/appointments.ts
import Elysia, { t } from "elysia";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";
import { getAvailableSlots } from "../services/availability.service";
import { createPixPayment } from "../services/mercadopago.service";
import { addMinutes, format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

const createSchema = z.object({
  barberProfileId: z.string(),
  serviceId:       z.string(),
  scheduledAt:     z.string(),
  paymentMethod:   z.enum(["CASH", "PIX"]),
  notes:           z.string().optional(),
});

export const appointmentRoutes = new Elysia({ prefix: "/appointments" })

  // ── GET /appointments/availability ───────────────────────────────────────
  .get(
    "/availability",
    async ({ query, set }) => {
      const { barberId, date, serviceId } = query;

      if (!barberId || !date || !serviceId) {
        set.status = 400;
        return { error: "barberId, date e serviceId são obrigatórios" };
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date as string)) {
        set.status = 400;
        return { error: "date deve estar no formato yyyy-MM-dd" };
      }

      const service = await prisma.service.findUnique({
        where: { id: serviceId as string, isActive: true },
      });
      if (!service) {
        set.status = 404;
        return { error: "Serviço não encontrado" };
      }

      const slots = await getAvailableSlots(
        barberId as string,
        date as string,
        service.duration
      );

      return { slots, date, barberId, serviceId };
    },
    {
      query: t.Object({
        barberId:  t.Optional(t.String()),
        date:      t.Optional(t.String()),
        serviceId: t.Optional(t.String()),
      }),
    }
  )

  // ── GET /appointments ─────────────────────────────────────────────────────
  .get(
    "/",
    async ({ headers, query, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;

      const page  = Math.max(1, Number(query.page)  || 1);
      const limit = Math.min(100, Number(query.limit) || 20);
      const skip  = (page - 1) * limit;
      const where: any = {};

      if (user.role === "CLIENT") {
        where.clientId = user.id;
      } else if (user.role === "BARBER" && user.barberProfile) {
        where.barberProfileId = user.barberProfile.id;
      }

      if (query.date) {
        const d = query.date as string;
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          where.scheduledAt = {
            gte: fromZonedTime(`${d}T00:00:00`, TIMEZONE),
            lte: fromZonedTime(`${d}T23:59:59`, TIMEZONE),
          };
        }
      }

      if (query.status) where.status = query.status;

      const [total, appointments] = await Promise.all([
        prisma.appointment.count({ where }),
        prisma.appointment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { scheduledAt: "asc" },
          include: {
            client: { select: { id: true, name: true, phone: true } },
            barberProfile: {
              include: { user: { select: { id: true, name: true } } },
            },
            service: true,
            comanda: {
              select: { id: true, status: true, paymentStatus: true, paymentMethod: true },
            },
          },
        }),
      ]);

      return {
        data: appointments,
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      };
    },
    {
      query: t.Object({
        page:   t.Optional(t.String()),
        limit:  t.Optional(t.String()),
        date:   t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
    }
  )

  // ── POST /appointments ────────────────────────────────────────────────────
  .post(
    "/",
    async ({ headers, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;

      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 422;
        return { error: parsed.error.flatten() };
      }

      const { barberProfileId, serviceId, scheduledAt, paymentMethod, notes } = parsed.data;

      const barber = await prisma.barberProfile.findUnique({
        where: { id: barberProfileId, isAvailable: true },
        include: { user: { select: { name: true, email: true } } },
      });
      if (!barber) {
        set.status = 404;
        return { error: "Barbeiro não encontrado ou indisponível" };
      }

      const service = await prisma.service.findUnique({
        where: { id: serviceId, isActive: true },
      });
      if (!service) {
        set.status = 404;
        return { error: "Serviço não encontrado" };
      }

      const startTime = new Date(scheduledAt);
      if (isNaN(startTime.getTime())) {
        set.status = 422;
        return { error: "Data/hora inválida" };
      }

      const endsAt = addMinutes(startTime, service.duration);

      const localDateStr = format(
        new Date(startTime.toLocaleString("en-US", { timeZone: TIMEZONE })),
        "yyyy-MM-dd"
      );
      const requestedTime = format(
        new Date(startTime.toLocaleString("en-US", { timeZone: TIMEZONE })),
        "HH:mm"
      );

      const availableSlots = await getAvailableSlots(
        barberProfileId,
        localDateStr,
        service.duration
      );

      if (!availableSlots.includes(requestedTime)) {
        set.status = 409;
        return { error: "Horário não disponível" };
      }

      const appointment = await prisma.appointment.create({
        data: {
          clientId:       user.id,
          barberProfileId,
          serviceId,
          scheduledAt:    startTime,
          endsAt,
          notes,
          status:         "PENDING",
        },
        include: {
          service: true,
          barberProfile: {
            include: { user: { select: { name: true, email: true } } },
          },
          client: { select: { id: true, name: true, email: true } },
        },
      });

      set.status = 201;

      if (paymentMethod === "CASH") {
        await prisma.comanda.create({
          data: {
            appointmentId: appointment.id,
            totalAmount:   service.price,
            status:        "OPEN",
            paymentMethod: "CASH",
            paymentStatus: "PENDING",
          },
        });
        return { appointment, paymentMethod: "CASH", pix: null };
      }

      try {
        const clientName = appointment.client.name.trim();
        const nameParts  = clientName.split(" ");
        const firstName  = nameParts[0];
        const lastName   = nameParts.slice(1).join(" ") || ".";

        const pix = await createPixPayment({
          appointmentId:  appointment.id,
          amount:         Number(service.price),
          description:    `${service.name} - The House Barber`,
          payerEmail:     appointment.client.email,
          payerFirstName: firstName,
          payerLastName:  lastName,
        });

        await prisma.comanda.create({
          data: {
            appointmentId: appointment.id,
            totalAmount:   service.price,
            status:        "OPEN",
            paymentMethod: "PIX",
            paymentStatus: "PENDING",
            pixTxId:       String(pix.mpPaymentId),
          },
        });

        return {
          appointment,
          paymentMethod: "PIX",
          pix: {
            qrCode:        pix.qrCode,
            qrCodeBase64:  pix.qrCodeBase64,
            pixCopiaECola: pix.pixCopiaECola,
            ticketUrl:     pix.ticketUrl,
            expiresAt:     pix.expiresAt,
            mpPaymentId:   pix.mpPaymentId,
          },
        };
      } catch (err: any) {
        await prisma.appointment.delete({ where: { id: appointment.id } });
        console.error("[PIX] Erro ao criar pagamento:", err.message);
        set.status = 502;
        return {
          error: "Erro ao iniciar pagamento PIX. Tente pagar em dinheiro ou tente novamente.",
        };
      }
    },
    {
      body: t.Object({
        barberProfileId: t.String(),
        serviceId:       t.String(),
        scheduledAt:     t.String(),
        paymentMethod:   t.Union([t.Literal("CASH"), t.Literal("PIX")]),
        notes:           t.Optional(t.String()),
      }),
    }
  )

  // ── PATCH /appointments/:id/status ────────────────────────────────────────
  // Fluxo simplificado: PENDING → CANCELLED | NO_SHOW
  // COMPLETED é gerado automaticamente ao fechar a comanda.
  .patch(
    "/:id/status",
    async ({ headers, params, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;

      const { status, cancelReason } = body as {
        status: string;
        cancelReason?: string;
      };

      const appointment = await prisma.appointment.findUnique({
        where: { id: params.id },
        include: { barberProfile: true },
      });
      if (!appointment) {
        set.status = 404;
        return { error: "Agendamento não encontrado" };
      }

      const isClient = appointment.clientId === user.id;
      const isBarber = user.role === "BARBER" && appointment.barberProfile.userId === user.id;
      const isAdmin  = user.role === "ADMIN";

      if (!isClient && !isBarber && !isAdmin) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      // Transições permitidas
      // PENDING → CANCELLED (cliente, barbeiro, admin)
      // PENDING → NO_SHOW   (barbeiro, admin)
      const allowed: Record<string, string[]> = {
        PENDING: ["CANCELLED", "NO_SHOW"],
      };

      if (!allowed[appointment.status]?.includes(status)) {
        set.status = 422;
        return {
          error: `Transição inválida: ${appointment.status} → ${status}`,
        };
      }

      // NO_SHOW só pode ser marcado pelo barbeiro ou admin
      if (status === "NO_SHOW" && !isBarber && !isAdmin) {
        set.status = 403;
        return { error: "Apenas o barbeiro pode marcar como não compareceu" };
      }

      const updated = await prisma.appointment.update({
        where: { id: params.id },
        data: { status: status as any, cancelReason },
      });

      return updated;
    },
    {
      body: t.Object({
        status:       t.String(),
        cancelReason: t.Optional(t.String()),
      }),
    }
  )

  // ── DELETE /appointments/:id ──────────────────────────────────────────────
  .delete(
    "/:id",
    async ({ headers, params, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;

      const appointment = await prisma.appointment.findUnique({
        where: { id: params.id },
      });
      if (!appointment) {
        set.status = 404;
        return { error: "Agendamento não encontrado" };
      }

      if (appointment.clientId !== user.id && user.role !== "ADMIN" && user.role !== "BARBER") {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      if (appointment.status !== "PENDING") {
        set.status = 422;
        return { error: "Somente agendamentos pendentes podem ser cancelados" };
      }

      await prisma.appointment.update({
        where: { id: params.id },
        data: { status: "CANCELLED", cancelReason: "Cancelado pelo usuário" },
      });

      return { message: "Agendamento cancelado com sucesso" };
    }
  );