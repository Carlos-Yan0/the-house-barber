// src/routes/appointments.ts
import Elysia, { t } from "elysia";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";
import { getAvailableSlots } from "../services/availability.service";
import { addMinutes, startOfDay, endOfDay, format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

const createSchema = z.object({
  barberProfileId: z.string(),
  serviceId: z.string(),
  scheduledAt: z.string(),
  notes: z.string().optional(),
});

export const appointmentRoutes = new Elysia({ prefix: "/appointments" })

  // GET /appointments/availability
  .get(
    "/availability",
    async ({ query, set }) => {
      const { barberId, date, serviceId } = query;
      if (!barberId || !date || !serviceId) {
        set.status = 400;
        return { error: "barberId, date e serviceId são obrigatórios" };
      }
      const service = await prisma.service.findUnique({ where: { id: serviceId as string } });
      if (!service) { set.status = 404; return { error: "Serviço não encontrado" }; }
      const slots = await getAvailableSlots(barberId as string, new Date(date as string), service.duration);
      return { slots, date, barberId, serviceId };
    },
    {
      query: t.Object({
        barberId: t.Optional(t.String()),
        date: t.Optional(t.String()),
        serviceId: t.Optional(t.String()),
      }),
    }
  )

  // GET /appointments
  .get(
    "/",
    async ({ headers, query, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;

      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const skip = (page - 1) * limit;
      let where: any = {};

      if (user.role === "CLIENT") {
        where.clientId = user.id;
      } else if (user.role === "BARBER" && user.barberProfile) {
        where.barberProfileId = user.barberProfile.id;
      }

      if (query.date) {
        // Parse date in Brazil timezone to avoid UTC offset issues
        const [y, m, d] = (query.date as string).split("-").map(Number);
        const dayStartBR = fromZonedTime(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T00:00:00`, TIMEZONE);
        const dayEndBR   = fromZonedTime(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T23:59:59`, TIMEZONE);
        where.scheduledAt = { gte: dayStartBR, lte: dayEndBR };
      }
      if (query.status) where.status = query.status;

      const [total, appointments] = await Promise.all([
        prisma.appointment.count({ where }),
        prisma.appointment.findMany({
          where, skip, take: limit,
          orderBy: { scheduledAt: "desc" },
          include: {
            client: { select: { id: true, name: true, phone: true } },
            barberProfile: { include: { user: { select: { id: true, name: true } } } },
            service: true,
            comanda: { select: { id: true, status: true, paymentStatus: true } },
          },
        }),
      ]);

      return { data: appointments, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
    },
    {
      query: t.Object({
        page: t.Optional(t.String()), limit: t.Optional(t.String()),
        date: t.Optional(t.String()), status: t.Optional(t.String()),
      }),
    }
  )

  // POST /appointments
  .post(
    "/",
    async ({ headers, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const userId = auth.user.id;

      const parsed = createSchema.safeParse(body);
      if (!parsed.success) { set.status = 422; return { error: parsed.error.flatten() }; }

      const { barberProfileId, serviceId, scheduledAt, notes } = parsed.data;

      const service = await prisma.service.findUnique({ where: { id: serviceId, isActive: true } });
      if (!service) { set.status = 404; return { error: "Serviço não encontrado" }; }

      const startTime = new Date(scheduledAt);
      const endsAt = addMinutes(startTime, service.duration);

      // Check conflicts
      const conflict = await prisma.appointment.findFirst({
        where: {
          barberProfileId,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          OR: [
            { scheduledAt: { lte: startTime }, endsAt: { gt: startTime } },
            { scheduledAt: { lt: endsAt }, endsAt: { gte: endsAt } },
            { scheduledAt: { gte: startTime }, endsAt: { lte: endsAt } },
          ],
        },
      });
      if (conflict) { set.status = 409; return { error: "Horário já ocupado" }; }

      const appointment = await prisma.appointment.create({
        data: {
          clientId: userId,
          barberProfileId,
          serviceId,
          scheduledAt: startTime,
          endsAt,
          notes,
          status: "PENDING",
        },
        include: {
          service: true,
          barberProfile: { include: { user: { select: { name: true } } } },
        },
      });

      set.status = 201;
      return appointment;
    },
    {
      body: t.Object({
        barberProfileId: t.String(), serviceId: t.String(),
        scheduledAt: t.String(), notes: t.Optional(t.String()),
      }),
    }
  )

  // PATCH /appointments/:id/status
  .patch(
    "/:id/status",
    async ({ headers, params, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;
      const { status, cancelReason } = body as { status: string; cancelReason?: string };

      const appointment = await prisma.appointment.findUnique({
        where: { id: params.id },
        include: { barberProfile: true },
      });
      if (!appointment) { set.status = 404; return { error: "Agendamento não encontrado" }; }

      const isClient = appointment.clientId === user.id;
      const isBarber = user.role === "BARBER" && appointment.barberProfile.userId === user.id;
      const isAdmin = user.role === "ADMIN";
      if (!isClient && !isBarber && !isAdmin) { set.status = 403; return { error: "Acesso negado" }; }

      const allowed: Record<string, string[]> = {
        PENDING: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
        IN_PROGRESS: ["COMPLETED"],
      };
      if (!allowed[appointment.status]?.includes(status)) {
        set.status = 422;
        return { error: `Transição inválida: ${appointment.status} → ${status}` };
      }

      const updated = await prisma.appointment.update({
        where: { id: params.id },
        data: { status: status as any, cancelReason },
      });

      if (status === "IN_PROGRESS") {
        const service = await prisma.service.findUnique({ where: { id: appointment.serviceId } });
        await prisma.comanda.upsert({
          where: { appointmentId: params.id },
          create: { appointmentId: params.id, totalAmount: service!.price, status: "OPEN", paymentStatus: "PENDING" },
          update: {},
        });
      }

      return updated;
    },
    { body: t.Object({ status: t.String(), cancelReason: t.Optional(t.String()) }) }
  )

  // DELETE /appointments/:id
  .delete(
    "/:id",
    async ({ headers, params, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
      const { user } = auth;

      const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
      if (!appointment) { set.status = 404; return { error: "Agendamento não encontrado" }; }

      if (appointment.clientId !== user.id && user.role !== "ADMIN" && user.role !== "BARBER") {
        set.status = 403; return { error: "Acesso negado" };
      }

      await prisma.appointment.update({
        where: { id: params.id },
        data: { status: "CANCELLED", cancelReason: "Cancelado pelo usuário" },
      });
      return { message: "Agendamento cancelado" };
    }
  );