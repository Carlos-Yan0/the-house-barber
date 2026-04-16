// src/routes/appointments.ts
import Elysia, { t } from "elysia";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";
import { getAvailableSlots } from "../services/availability.service";
import { createPixPayment } from "../services/mercadopago.service";
import { addMinutes, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { publicRouteCache } from "../lib/ttlCache";

const TIMEZONE = "America/Sao_Paulo";
const APPOINTMENT_OVERLAP_CONSTRAINT = "appointments_no_overlap_active";
const APPOINTMENT_INTERVAL_CONSTRAINT = "appointments_valid_interval_chk";
const ACTIVE_SERVICE_CACHE_TTL_MS = 60_000;

type AvailabilityQuery = {
  barberId: string;
  date: string;
  serviceId: string;
};

type AvailabilityWsMessage =
  | {
      type: "availability";
      slots: string[];
      date: string;
      barberId: string;
      serviceId: string;
    }
  | {
      type: "error";
      error: string;
      status?: number;
    };

type AvailabilitySocket = {
  id?: string;
  send: (data: AvailabilityWsMessage) => unknown;
};

type AvailabilitySubscription = {
  id: string;
  ws: AvailabilitySocket;
  query: AvailabilityQuery;
};

const availabilitySubscriptions = new Map<string, AvailabilitySubscription>();

async function getActiveServiceSnapshot(serviceId: string) {
  return publicRouteCache.getOrSet(
    `services:active:${serviceId}`,
    ACTIVE_SERVICE_CACHE_TTL_MS,
    async () => {
      const service = await prisma.service.findUnique({
        where: { id: serviceId, isActive: true },
        select: {
          id: true,
          name: true,
          duration: true,
          price: true,
        },
      });

      if (!service) {
        throw new Error("__SERVICE_NOT_FOUND__");
      }

      return service;
    }
  );
}

function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getAvailabilitySocketId(ws: AvailabilitySocket): string {
  if (!ws.id) ws.id = crypto.randomUUID();
  return ws.id;
}

function registerAvailabilitySubscription(ws: AvailabilitySocket, query: AvailabilityQuery) {
  const id = getAvailabilitySocketId(ws);
  availabilitySubscriptions.set(id, { id, ws, query });
}

function unregisterAvailabilitySubscription(ws: AvailabilitySocket) {
  if (!ws.id) return;
  availabilitySubscriptions.delete(ws.id);
}

async function buildAvailabilitySnapshot(query: AvailabilityQuery): Promise<AvailabilityWsMessage> {
  const { barberId, date, serviceId } = query;

  if (!barberId || !date || !serviceId) {
    return { type: "error", status: 400, error: "barberId, date e serviceId são obrigatórios" };
  }

  if (!isValidDateInput(date)) {
    return { type: "error", status: 400, error: "date deve estar no formato yyyy-MM-dd" };
  }

  const service = await getActiveServiceSnapshot(serviceId).catch((error: Error) => {
    if (error.message === "__SERVICE_NOT_FOUND__") return null;
    throw error;
  });

  if (!service) {
    return { type: "error", status: 404, error: "Serviço não encontrado" };
  }

  const slots = await getAvailableSlots(barberId, date, service.duration);
  return { type: "availability", slots, date, barberId, serviceId };
}

async function sendAvailabilitySnapshot(ws: AvailabilitySocket, query: AvailabilityQuery) {
  const payload = await buildAvailabilitySnapshot(query);
  ws.send(payload);
}

async function notifyAvailabilitySubscribers(barberId: string, date: string) {
  const subscribers = [...availabilitySubscriptions.values()].filter(
    ({ query }) => query.barberId === barberId && query.date === date
  );

  for (const subscriber of subscribers) {
    try {
      await sendAvailabilitySnapshot(subscriber.ws, subscriber.query);
    } catch {
      availabilitySubscriptions.delete(subscriber.id);
    }
  }
}

function isAppointmentConflictError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return true;
    if (error.code === "P2004") {
      const details = String(error.meta?.database_error ?? "");
      return details.includes(APPOINTMENT_OVERLAP_CONSTRAINT);
    }
  }

  if (error instanceof Error) {
    return (
      error.message.includes(APPOINTMENT_OVERLAP_CONSTRAINT) ||
      error.message.includes("conflicting key value violates exclusion constraint")
    );
  }

  return false;
}

function isInvalidAppointmentIntervalError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004") {
    const details = String(error.meta?.database_error ?? "");
    return details.includes(APPOINTMENT_INTERVAL_CONSTRAINT);
  }

  if (error instanceof Error) {
    return error.message.includes(APPOINTMENT_INTERVAL_CONSTRAINT);
  }

  return false;
}

const createSchema = z.object({
  barberProfileId: z.string(),
  serviceId:       z.string(),
  scheduledAt:     z.string(),
  paymentMethod:   z.enum(["CASH", "PIX"]),
  clientNameOverride: z.string().trim().min(2).max(100).optional(),
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

      const service = await getActiveServiceSnapshot(serviceId as string).catch((error: Error) => {
        if (error.message === "__SERVICE_NOT_FOUND__") return null;
        throw error;
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
  .ws("/availability/ws", {
    query: t.Object({
      barberId: t.String(),
      date: t.String(),
      serviceId: t.String(),
    }),
    async open(ws) {
      const query = ws.data.query as AvailabilityQuery;
      registerAvailabilitySubscription(ws, query);
      await sendAvailabilitySnapshot(ws, query);
    },
    async message(ws) {
      const query = ws.data.query as AvailabilityQuery;
      await sendAvailabilitySnapshot(ws, query);
    },
    close(ws) {
      unregisterAvailabilitySubscription(ws);
    },
  })

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

      const {
        barberProfileId,
        serviceId,
        scheduledAt,
        paymentMethod,
        clientNameOverride,
        notes,
      } = parsed.data;

      const canUseClientNameOverride = Boolean(
        (user.role === "BARBER" || user.role === "ADMIN") &&
        user.barberProfile &&
        user.barberProfile.id === barberProfileId
      );
      const normalizedClientNameOverride =
        canUseClientNameOverride && clientNameOverride ? clientNameOverride.trim() : undefined;

      const barber = await prisma.barberProfile.findUnique({
        where: { id: barberProfileId, isAvailable: true },
        include: { user: { select: { name: true, email: true } } },
      });
      if (!barber) {
        set.status = 404;
        return { error: "Barbeiro não encontrado ou indisponível" };
      }

      const service = await getActiveServiceSnapshot(serviceId).catch((error: Error) => {
        if (error.message === "__SERVICE_NOT_FOUND__") return null;
        throw error;
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

      let appointment;
      try {
        appointment = await prisma.appointment.create({
          data: {
            clientId:       user.id,
            barberProfileId,
            serviceId,
            scheduledAt:    startTime,
            endsAt,
            clientNameOverride: normalizedClientNameOverride,
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
      } catch (error) {
        if (isAppointmentConflictError(error)) {
          set.status = 409;
          return { error: "Horário não disponível" };
        }
        if (isInvalidAppointmentIntervalError(error)) {
          set.status = 422;
          return { error: "Data/hora inválida" };
        }
        throw error;
      }

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
        await notifyAvailabilitySubscribers(barberProfileId, localDateStr);
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
        await notifyAvailabilitySubscribers(barberProfileId, localDateStr);

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
        clientNameOverride: t.Optional(t.String()),
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

      const appointmentDate = format(
        toZonedTime(appointment.scheduledAt, TIMEZONE),
        "yyyy-MM-dd"
      );
      await notifyAvailabilitySubscribers(appointment.barberProfileId, appointmentDate);

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

      const appointmentDate = format(
        toZonedTime(appointment.scheduledAt, TIMEZONE),
        "yyyy-MM-dd"
      );
      await notifyAvailabilitySubscribers(appointment.barberProfileId, appointmentDate);

      return { message: "Agendamento cancelado com sucesso" };
    }
  );
