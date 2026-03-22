// src/routes/comandas.ts
import Elysia, { t } from "elysia";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";

export const comandaRoutes = new Elysia({ prefix: "/comandas" })

  .get(
    "/",
    async ({ headers, query, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) {
        set.status = auth.status;
        return { error: auth.error };
      }

      const where: any = {};
      if (auth.user.role === "BARBER" && auth.user.barberProfile) {
        where.appointment = { barberProfileId: auth.user.barberProfile.id };
      }
      if (query.status) where.status = query.status;

      return prisma.comanda.findMany({
        where,
        include: {
          appointment: {
            include: {
              client: { select: { name: true } },
              service: { select: { name: true, price: true } },
              barberProfile: { include: { user: { select: { name: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    },
    { query: t.Object({ status: t.Optional(t.String()) }) }
  )

  .get("/:id", async ({ headers, params, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) {
      set.status = auth.status;
      return { error: auth.error };
    }

    const comanda = await prisma.comanda.findUnique({
      where: { id: params.id },
      include: {
        appointment: {
          include: {
            client: { select: { id: true, name: true, phone: true } },
            barberProfile: { include: { user: { select: { id: true, name: true } } } },
            service: true,
          },
        },
        commission: true,
      },
    });

    if (!comanda) {
      set.status = 404;
      return { error: "Comanda não encontrada" };
    }

    const isClient = comanda.appointment.clientId === auth.user.id;
    const isBarber = comanda.appointment.barberProfile.userId === auth.user.id;
    if (!isClient && !isBarber && auth.user.role !== "ADMIN") {
      set.status = 403;
      return { error: "Acesso negado" };
    }

    return comanda;
  })

  .patch(
    "/:id/close",
    async ({ headers, params, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) {
        set.status = auth.status;
        return { error: auth.error };
      }

      const comanda = await prisma.comanda.findUnique({
        where: { id: params.id },
        include: {
          appointment: {
            include: { barberProfile: true, service: true },
          },
        },
      });

      if (!comanda) {
        set.status = 404;
        return { error: "Comanda não encontrada" };
      }
      if (comanda.status === "CLOSED") {
        set.status = 409;
        return { error: "Comanda já fechada" };
      }

      const isBarber =
        comanda.appointment.barberProfile.userId === auth.user.id;
      if (!isBarber && auth.user.role !== "ADMIN") {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      const { paymentMethod } = body as { paymentMethod: string };

      const [updated] = await prisma.$transaction([
        prisma.comanda.update({
          where: { id: params.id },
          data: {
            status: "CLOSED",
            paymentMethod: paymentMethod as any,
            paymentStatus: "PAID",
            paidAt: new Date(),
            closedAt: new Date(),
          },
        }),
        prisma.appointment.update({
          where: { id: comanda.appointmentId },
          data: { status: "COMPLETED" },
        }),
      ]);

      // Verifica se o barbeiro é ADMIN — se for, não gera comissão
      const bp = comanda.appointment.barberProfile;
      const barberUser = await prisma.user.findUnique({
        where: { id: bp.userId },
        select: { role: true },
      });

      if (barberUser?.role !== "ADMIN") {
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

      return { ...updated, message: "Comanda fechada com sucesso" };
    },
    { body: t.Object({ paymentMethod: t.String() }) }
  );