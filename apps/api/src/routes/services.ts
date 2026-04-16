// src/routes/services.ts
import Elysia, { t } from "elysia";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getUserFromHeader } from "../lib/getUser";
import { publicRouteCache } from "../lib/ttlCache";

const PUBLIC_SERVICES_CACHE_TTL_MS = 60_000;

const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  duration: z.number().int().min(5).max(480),
  price: z.number().positive(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const serviceRoutes = new Elysia({ prefix: "/services" })
  .get(
    "/",
    async ({ query, set }) => {
      const includeInactive = query.all === "true";

      if (!includeInactive) {
        set.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=120";
      }

      return publicRouteCache.getOrSet(
        `services:list:${includeInactive ? "all" : "active"}`,
        PUBLIC_SERVICES_CACHE_TTL_MS,
        () =>
          prisma.service.findMany({
            where: { isActive: includeInactive ? undefined : true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              description: true,
              duration: true,
              price: true,
              isActive: true,
              sortOrder: true,
            },
          })
      );
    },
    { query: t.Object({ all: t.Optional(t.String()) }) }
  )

  .get("/:id", async ({ params, set }) => {
    const service = await prisma.service.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        description: true,
        duration: true,
        price: true,
        isActive: true,
        sortOrder: true,
      },
    });

    if (!service) {
      set.status = 404;
      return { error: "Serviço não encontrado" };
    }

    return service;
  })

  .post(
    "/",
    async ({ headers, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) {
        set.status = auth.status;
        return { error: auth.error };
      }
      if (auth.user.role !== "ADMIN") {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      const parsed = serviceSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 422;
        return { error: parsed.error.flatten() };
      }

      const service = await prisma.service.create({ data: parsed.data });
      publicRouteCache.deleteByPrefix("services:list:");
      publicRouteCache.deleteByPrefix("services:active:");
      set.status = 201;
      return service;
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        duration: t.Number(),
        price: t.Number(),
        isActive: t.Optional(t.Boolean()),
        sortOrder: t.Optional(t.Number()),
      }),
    }
  )

  .put(
    "/:id",
    async ({ headers, params, body, set }) => {
      const auth = await getUserFromHeader(headers.authorization);
      if (!auth.user) {
        set.status = auth.status;
        return { error: auth.error };
      }
      if (auth.user.role !== "ADMIN") {
        set.status = 403;
        return { error: "Acesso negado" };
      }

      const parsed = serviceSchema.partial().safeParse(body);
      if (!parsed.success) {
        set.status = 422;
        return { error: parsed.error.flatten() };
      }

      const updated = await prisma.service.update({
        where: { id: params.id },
        data: parsed.data,
      });
      publicRouteCache.deleteByPrefix("services:list:");
      publicRouteCache.deleteByPrefix("services:active:");
      return updated;
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
        price: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
        sortOrder: t.Optional(t.Number()),
      }),
    }
  )

  .delete("/:id", async ({ headers, params, set }) => {
    const auth = await getUserFromHeader(headers.authorization);
    if (!auth.user) {
      set.status = auth.status;
      return { error: auth.error };
    }
    if (auth.user.role !== "ADMIN") {
      set.status = 403;
      return { error: "Acesso negado" };
    }

    await prisma.service.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    publicRouteCache.deleteByPrefix("services:list:");
    publicRouteCache.deleteByPrefix("services:active:");
    return { message: "Serviço desativado" };
  });
