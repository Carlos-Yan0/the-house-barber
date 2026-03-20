// src/routes/services.ts
import Elysia, { t } from "elysia";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";

const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  duration: z.number().int().min(5).max(480),
  price: z.number().positive(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const serviceRoutes = new Elysia({ prefix: "/services" })

  .get("/", async ({ query }) => {
    return prisma.service.findMany({
      where: { isActive: query.all === "true" ? undefined : true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }, { query: t.Object({ all: t.Optional(t.String()) }) })

  .get("/:id", async ({ params, set }) => {
    const service = await prisma.service.findUnique({ where: { id: params.id } });
    if (!service) { set.status = 404; return { error: "Serviço não encontrado" }; }
    return service;
  })

  .post("/", async ({ headers, body, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
    if (auth.user.role !== "ADMIN") { set.status = 403; return { error: "Acesso negado" }; }

    const parsed = serviceSchema.safeParse(body);
    if (!parsed.success) { set.status = 422; return { error: parsed.error.flatten() }; }

    const service = await prisma.service.create({ data: parsed.data });
    set.status = 201;
    return service;
  }, {
    body: t.Object({
      name: t.String(), description: t.Optional(t.String()),
      duration: t.Number(), price: t.Number(),
      isActive: t.Optional(t.Boolean()), sortOrder: t.Optional(t.Number()),
    }),
  })

  .put("/:id", async ({ headers, params, body, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
    if (auth.user.role !== "ADMIN") { set.status = 403; return { error: "Acesso negado" }; }

    const parsed = serviceSchema.partial().safeParse(body);
    if (!parsed.success) { set.status = 422; return { error: parsed.error.flatten() }; }

    return prisma.service.update({ where: { id: params.id }, data: parsed.data });
  }, {
    body: t.Object({
      name: t.Optional(t.String()), description: t.Optional(t.String()),
      duration: t.Optional(t.Number()), price: t.Optional(t.Number()),
      isActive: t.Optional(t.Boolean()), sortOrder: t.Optional(t.Number()),
    }),
  })

  .delete("/:id", async ({ headers, params, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) { set.status = auth.status; return { error: auth.error }; }
    if (auth.user.role !== "ADMIN") { set.status = 403; return { error: "Acesso negado" }; }

    await prisma.service.update({ where: { id: params.id }, data: { isActive: false } });
    return { message: "Serviço desativado" };
  });