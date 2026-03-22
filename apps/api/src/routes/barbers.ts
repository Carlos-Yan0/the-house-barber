// src/routes/barbers.ts
import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";

export const barberRoutes = new Elysia({ prefix: "/barbers" })

  // GET /barbers — public
  .get("/", async () => {
    return prisma.barberProfile.findMany({
      where: { isAvailable: true, user: { isActive: true } },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        schedules: { where: { isActive: true }, orderBy: { dayOfWeek: "asc" } },
      },
    });
  })

  // GET /barbers/:id — public
  .get("/:id", async ({ params, set }) => {
    const barber = await prisma.barberProfile.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, email: true } },
        schedules: { where: { isActive: true } },
      },
    });
    if (!barber) { set.status = 404; return { error: "Barbeiro não encontrado" }; }
    return barber;
  })

  // GET /barbers/:id/schedule — protected
  .get("/:id/schedule", async ({ headers, params, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) { set.status = auth.status; return { error: auth.error }; }

    const barber = await prisma.barberProfile.findUnique({
      where: { id: params.id },
      include: { schedules: true, blockedDates: true },
    });
    if (!barber) { set.status = 404; return { error: "Barbeiro não encontrado" }; }

    if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
      set.status = 403; return { error: "Acesso negado" };
    }
    return barber;
  })

  // PUT /barbers/:id/schedule — protected
  .put("/:id/schedule", async ({ headers, params, body, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) { set.status = auth.status; return { error: auth.error }; }

    const barber = await prisma.barberProfile.findUnique({ where: { id: params.id } });
    if (!barber) { set.status = 404; return { error: "Barbeiro não encontrado" }; }
    if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
      set.status = 403; return { error: "Acesso negado" };
    }

    const { schedules } = body as { schedules: any[] };
    return Promise.all(
      schedules.map((s) =>
        prisma.barberSchedule.upsert({
          where: { barberProfileId_dayOfWeek: { barberProfileId: params.id, dayOfWeek: s.dayOfWeek } },
          create: { barberProfileId: params.id, ...s },
          update: { startTime: s.startTime, endTime: s.endTime, slotDuration: s.slotDuration, isActive: s.isActive },
        })
      )
    );
  }, {
    body: t.Object({
      schedules: t.Array(t.Object({
        dayOfWeek: t.String(), startTime: t.String(), endTime: t.String(),
        slotDuration: t.Number(), isActive: t.Boolean(),
      })),
    }),
  })

  // POST /barbers/:id/blocked-dates — protected
  .post("/:id/blocked-dates", async ({ headers, params, body, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) { set.status = auth.status; return { error: auth.error }; }

    const barber = await prisma.barberProfile.findUnique({ where: { id: params.id } });
    if (!barber) { set.status = 404; return { error: "Barbeiro não encontrado" }; }
    if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
      set.status = 403; return { error: "Acesso negado" };
    }

    const { date, reason } = body as { date: string; reason?: string };
    const blocked = await prisma.barberBlockedDate.upsert({
      where: { barberProfileId_date: { barberProfileId: params.id, date: new Date(date) } },
      create: { barberProfileId: params.id, date: new Date(date), reason },
      update: { reason },
    });
    set.status = 201;
    return blocked;
  }, {
    body: t.Object({ date: t.String(), reason: t.Optional(t.String()) }),
  })

  // DELETE /barbers/:id/blocked-dates/:dateId — protected
  .delete("/:id/blocked-dates/:dateId", async ({ headers, params, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) { set.status = auth.status; return { error: auth.error }; }

    const barber = await prisma.barberProfile.findUnique({ where: { id: params.id } });
    if (!barber) { set.status = 404; return { error: "Barbeiro não encontrado" }; }
    if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
      set.status = 403; return { error: "Acesso negado" };
    }

    await prisma.barberBlockedDate.delete({ where: { id: params.dateId } });
    return { message: "Data desbloqueada com sucesso" };
  })

  // PATCH /barbers/:id/availability — protected
  // Permite ao próprio barbeiro (ou admin) ativar/desativar disponibilidade
  // sem afetar o role ou conta do usuário.
  .patch("/:id/availability", async ({ headers, params, body, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) { set.status = auth.status; return { error: auth.error }; }

    const barber = await prisma.barberProfile.findUnique({ where: { id: params.id } });
    if (!barber) { set.status = 404; return { error: "Barbeiro não encontrado" }; }

    if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
      set.status = 403; return { error: "Acesso negado" };
    }

    const { isAvailable } = body as { isAvailable: boolean };

    const updated = await prisma.barberProfile.update({
      where: { id: params.id },
      data: { isAvailable },
    });

    return updated;
  }, {
    body: t.Object({ isAvailable: t.Boolean() }),
  })

  // GET /barbers/:id/earnings — protected
  .get("/:id/earnings", async ({ headers, params, query, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) { set.status = auth.status; return { error: auth.error }; }

    const barber = await prisma.barberProfile.findUnique({ where: { id: params.id } });
    if (!barber) { set.status = 404; return { error: "Barbeiro não encontrado" }; }
    if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
      set.status = 403; return { error: "Acesso negado" };
    }

    const where: any = { barberProfileId: params.id };
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate as string);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate as string);
    }

    const commissions = await prisma.commission.findMany({
      where,
      select: {
        id: true,
        grossAmount: true,
        commissionRate: true,
        commissionAmount: true,
        isPaid: true,
        paidAt: true,
        createdAt: true,
        comanda: {
          select: { id: true, appointmentId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const appointmentIds = commissions
      .map((c) => c.comanda?.appointmentId)
      .filter(Boolean) as string[];

    const appointments = appointmentIds.length
      ? await prisma.appointment.findMany({
          where: { id: { in: appointmentIds } },
          select: {
            id: true,
            service: { select: { name: true } },
            client: { select: { name: true } },
          },
        })
      : [];

    const aptMap = new Map(appointments.map((a) => [a.id, a]));

    const result = commissions.map((c) => {
      const apt = c.comanda?.appointmentId ? aptMap.get(c.comanda.appointmentId) : null;
      return {
        ...c,
        comanda: c.comanda
          ? { ...c.comanda, appointment: apt ? { service: apt.service, client: apt.client } : null }
          : null,
      };
    });

    const totalGross      = result.reduce((s, c) => s + Number(c.grossAmount), 0);
    const totalCommission = result.reduce((s, c) => s + Number(c.commissionAmount), 0);
    return { commissions: result, totalGross, totalCommission };
  }, {
    query: t.Object({ startDate: t.Optional(t.String()), endDate: t.Optional(t.String()) }),
  });