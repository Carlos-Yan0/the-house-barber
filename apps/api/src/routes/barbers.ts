// src/routes/barbers.ts
import Elysia, { t } from "elysia";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";
import { publicRouteCache } from "../lib/ttlCache";

const PUBLIC_BARBERS_CACHE_TTL_MS = 60_000;

function isInvalidScheduleError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004") {
    const details = String(error.meta?.database_error ?? "");
    return (
      details.includes("barber_schedules_start_time_format_chk") ||
      details.includes("barber_schedules_end_time_format_chk") ||
      details.includes("barber_schedules_start_before_end_chk")
    );
  }

  if (error instanceof Error) {
    return (
      error.message.includes("barber_schedules_start_time_format_chk") ||
      error.message.includes("barber_schedules_end_time_format_chk") ||
      error.message.includes("barber_schedules_start_before_end_chk")
    );
  }

  return false;
}

function invalidatePublicBarberCache() {
  publicRouteCache.deleteByPrefix("barbers:");
}

export const barberRoutes = new Elysia({ prefix: "/barbers" })
  .get("/", async ({ set }) => {
    set.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120";

    return publicRouteCache.getOrSet("barbers:list:public", PUBLIC_BARBERS_CACHE_TTL_MS, () =>
      prisma.barberProfile.findMany({
        where: { isAvailable: true, user: { isActive: true } },
        select: {
          id: true,
          userId: true,
          bio: true,
          commissionRate: true,
          isAvailable: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          schedules: {
            where: { isActive: true },
            orderBy: { dayOfWeek: "asc" },
            select: {
              id: true,
              barberProfileId: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              slotDuration: true,
              isActive: true,
            },
          },
        },
      })
    );
  })

  .get("/:id", async ({ params, set }) => {
    const cacheKey = `barbers:detail:${params.id}`;
    set.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120";

    const barber = await publicRouteCache.getOrSet(cacheKey, PUBLIC_BARBERS_CACHE_TTL_MS, async () => {
      const found = await prisma.barberProfile.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          userId: true,
          bio: true,
          commissionRate: true,
          isAvailable: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
            },
          },
          schedules: {
            where: { isActive: true },
            orderBy: { dayOfWeek: "asc" },
            select: {
              id: true,
              barberProfileId: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              slotDuration: true,
              isActive: true,
            },
          },
        },
      });

      if (!found) {
        throw new Error("__BARBER_NOT_FOUND__");
      }

      return found;
    }).catch((error: Error) => {
      if (error.message === "__BARBER_NOT_FOUND__") return null;
      throw error;
    });

    if (!barber) {
      set.status = 404;
      return { error: "Barbeiro não encontrado" };
    }

    return barber;
  })

  .get("/:id/schedule", async ({ headers, params, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) {
      set.status = auth.status;
      return { error: auth.error };
    }

    const barber = await prisma.barberProfile.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        userId: true,
        schedules: true,
        blockedDates: true,
      },
    });
    if (!barber) {
      set.status = 404;
      return { error: "Barbeiro não encontrado" };
    }

    if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
      set.status = 403;
      return { error: "Acesso negado" };
    }
    return barber;
  })

  .put(
    "/:id/schedule",
    async ({ headers, params, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) {
        set.status = auth.status;
        return { error: auth.error };
      }

      const barber = await prisma.barberProfile.findUnique({
        where: { id: params.id },
        select: { id: true, userId: true },
      });
      if (!barber) {
        set.status = 404;
        return { error: "Barbeiro não encontrado" };
      }
      if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      const { schedules } = body as { schedules: Array<Record<string, unknown>> };
      try {
        const result = await Promise.all(
          schedules.map((s) =>
            prisma.barberSchedule.upsert({
              where: {
                barberProfileId_dayOfWeek: {
                  barberProfileId: params.id,
                  dayOfWeek: s.dayOfWeek as never,
                },
              },
              create: { barberProfileId: params.id, ...s } as never,
              update: {
                startTime: s.startTime as string,
                endTime: s.endTime as string,
                slotDuration: s.slotDuration as number,
                isActive: s.isActive as boolean,
              },
            })
          )
        );

        invalidatePublicBarberCache();
        return result;
      } catch (error) {
        if (isInvalidScheduleError(error)) {
          set.status = 422;
          return { error: "Horários inválidos. Use HH:mm e garanta startTime < endTime." };
        }
        throw error;
      }
    },
    {
      body: t.Object({
        schedules: t.Array(
          t.Object({
            dayOfWeek: t.String(),
            startTime: t.String(),
            endTime: t.String(),
            slotDuration: t.Number(),
            isActive: t.Boolean(),
          })
        ),
      }),
    }
  )

  .post(
    "/:id/blocked-dates",
    async ({ headers, params, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) {
        set.status = auth.status;
        return { error: auth.error };
      }

      const barber = await prisma.barberProfile.findUnique({
        where: { id: params.id },
        select: { id: true, userId: true },
      });
      if (!barber) {
        set.status = 404;
        return { error: "Barbeiro não encontrado" };
      }
      if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      const { date, reason } = body as { date: string; reason?: string };
      const blocked = await prisma.barberBlockedDate.upsert({
        where: {
          barberProfileId_date: {
            barberProfileId: params.id,
            date: new Date(date),
          },
        },
        create: { barberProfileId: params.id, date: new Date(date), reason },
        update: { reason },
      });

      invalidatePublicBarberCache();
      set.status = 201;
      return blocked;
    },
    {
      body: t.Object({ date: t.String(), reason: t.Optional(t.String()) }),
    }
  )

  .delete("/:id/blocked-dates/:dateId", async ({ headers, params, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) {
      set.status = auth.status;
      return { error: auth.error };
    }

    const barber = await prisma.barberProfile.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });
    if (!barber) {
      set.status = 404;
      return { error: "Barbeiro não encontrado" };
    }
    if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
      set.status = 403;
      return { error: "Acesso negado" };
    }

    await prisma.barberBlockedDate.delete({ where: { id: params.dateId } });
    invalidatePublicBarberCache();
    return { message: "Data desbloqueada com sucesso" };
  })

  .patch(
    "/:id/availability",
    async ({ headers, params, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) {
        set.status = auth.status;
        return { error: auth.error };
      }

      const barber = await prisma.barberProfile.findUnique({
        where: { id: params.id },
        select: { id: true, userId: true },
      });
      if (!barber) {
        set.status = 404;
        return { error: "Barbeiro não encontrado" };
      }

      if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      const { isAvailable } = body as { isAvailable: boolean };

      const updated = await prisma.barberProfile.update({
        where: { id: params.id },
        data: { isAvailable },
      });

      invalidatePublicBarberCache();
      return updated;
    },
    {
      body: t.Object({ isAvailable: t.Boolean() }),
    }
  )

  .get(
    "/:id/earnings",
    async ({ headers, params, query, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) {
        set.status = auth.status;
        return { error: auth.error };
      }

      const barber = await prisma.barberProfile.findUnique({
        where: { id: params.id },
        select: { id: true, userId: true },
      });
      if (!barber) {
        set.status = 404;
        return { error: "Barbeiro não encontrado" };
      }
      if (auth.user.role !== "ADMIN" && barber.userId !== auth.user.id) {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      const where: Record<string, unknown> = { barberProfileId: params.id };
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) (where.createdAt as Record<string, unknown>).gte = new Date(query.startDate as string);
        if (query.endDate) (where.createdAt as Record<string, unknown>).lte = new Date(query.endDate as string);
      }

      const commissions = await prisma.commission.findMany({
        where,
        select: {
          id: true,
          barberProfileId: true,
          comandaId: true,
          grossAmount: true,
          commissionRate: true,
          commissionAmount: true,
          isPaid: true,
          paidAt: true,
          createdAt: true,
          comanda: {
            select: {
              id: true,
              appointmentId: true,
              appointment: {
                select: {
                  service: { select: { name: true } },
                  client: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const totalGross = commissions.reduce((sum, item) => sum + Number(item.grossAmount), 0);
      const totalCommission = commissions.reduce((sum, item) => sum + Number(item.commissionAmount), 0);

      return { commissions, totalGross, totalCommission };
    },
    {
      query: t.Object({ startDate: t.Optional(t.String()), endDate: t.Optional(t.String()) }),
    }
  );
