// src/routes/admin.ts
import Elysia, { t } from "elysia";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";

async function requireAdmin(authHeader: string | undefined, set: any) {
  const auth = await getUserFromHeader(authHeader);
  if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
  if (auth.user.role !== "ADMIN") { set.status = 403; return { error: "Acesso negado" }; }
  return auth.user;
}

export const adminRoutes = new Elysia({ prefix: "/admin" })

  .get("/dashboard", async ({ headers, query, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    const date = query.date ? new Date(query.date as string) : new Date();
    const [todayAppointments, monthAppointments, openComandas, monthRevenue, totalClients, totalBarbers, pendingCommissions] =
      await Promise.all([
        prisma.appointment.count({ where: { scheduledAt: { gte: startOfDay(date), lte: endOfDay(date) } } }),
        prisma.appointment.count({ where: { scheduledAt: { gte: startOfMonth(date), lte: endOfMonth(date) } } }),
        prisma.comanda.count({ where: { status: "OPEN" } }),
        prisma.comanda.aggregate({ where: { status: "CLOSED", paymentStatus: "PAID", closedAt: { gte: startOfMonth(date), lte: endOfMonth(date) } }, _sum: { totalAmount: true } }),
        prisma.user.count({ where: { role: "CLIENT", isActive: true } }),
        prisma.user.count({ where: { role: "BARBER", isActive: true } }),
        prisma.commission.aggregate({ where: { isPaid: false }, _sum: { commissionAmount: true } }),
      ]);

    return {
      today: { appointments: todayAppointments, openComandas },
      month: { appointments: monthAppointments, revenue: Number(monthRevenue._sum.totalAmount ?? 0) },
      totals: { clients: totalClients, barbers: totalBarbers, pendingCommissions: Number(pendingCommissions._sum.commissionAmount ?? 0) },
    };
  }, { query: t.Object({ date: t.Optional(t.String()) }) })

  .get("/reports/revenue", async ({ headers, query, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    const start = query.start ? new Date(query.start as string) : startOfMonth(new Date());
    const end = query.end ? new Date(query.end as string) : endOfMonth(new Date());

    const comandas = await prisma.comanda.findMany({
      where: { status: "CLOSED", paymentStatus: "PAID", closedAt: { gte: start, lte: end } },
      include: {
        appointment: {
          include: {
            service: { select: { name: true } },
            barberProfile: { include: { user: { select: { name: true } } } },
          },
        },
        commission: true,
      },
      orderBy: { closedAt: "asc" },
    });

    const totalRevenue = comandas.reduce((s, c) => s + Number(c.totalAmount), 0);
    const totalCommissions = comandas.reduce((s, c) => s + Number(c.commission?.commissionAmount ?? 0), 0);
    const byBarber = comandas.reduce((acc: Record<string, any>, c) => {
      const name = c.appointment.barberProfile.user.name;
      if (!acc[name]) acc[name] = { revenue: 0, commissions: 0, count: 0 };
      acc[name].revenue += Number(c.totalAmount);
      acc[name].commissions += Number(c.commission?.commissionAmount ?? 0);
      acc[name].count++;
      return acc;
    }, {});
    const byService = comandas.reduce((acc: Record<string, any>, c) => {
      const name = c.appointment.service.name;
      if (!acc[name]) acc[name] = { revenue: 0, count: 0 };
      acc[name].revenue += Number(c.totalAmount);
      acc[name].count++;
      return acc;
    }, {});

    return { totalRevenue, totalCommissions, netRevenue: totalRevenue - totalCommissions, byBarber, byService, comandas };
  }, { query: t.Object({ start: t.Optional(t.String()), end: t.Optional(t.String()) }) })

  .post("/barbers", async ({ headers, body, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    const { name, email, password, phone, commissionRate } = body as {
      name: string; email: string; password: string; phone?: string; commissionRate?: number;
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { set.status = 409; return { error: "E-mail já cadastrado" }; }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: {
        name, email, phone, passwordHash, role: "BARBER",
        barberProfile: { create: { commissionRate: commissionRate ?? 0.5 } },
      },
      include: { barberProfile: true },
    });

    set.status = 201;
    return newUser;
  }, {
    body: t.Object({
      name: t.String(), email: t.String(), password: t.String(),
      phone: t.Optional(t.String()), commissionRate: t.Optional(t.Number()),
    }),
  })

  .get("/users", async ({ headers, query, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    return prisma.user.findMany({
      where: query.role ? { role: query.role as any } : undefined,
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        isActive: true, createdAt: true,
        barberProfile: { select: { id: true, commissionRate: true, isAvailable: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }, { query: t.Object({ role: t.Optional(t.String()) }) })

  .patch("/commissions/:id/pay", async ({ headers, params, set }) => {
    const user = await requireAdmin(headers.authorization, set);
    if ("error" in (user as any)) return user;

    const commission = await prisma.commission.findUnique({ where: { id: params.id } });
    if (!commission) { set.status = 404; return { error: "Comissão não encontrada" }; }

    return prisma.commission.update({
      where: { id: params.id },
      data: { isPaid: true, paidAt: new Date() },
    });
  });