// src/index.ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./routes/auth";
import { serviceRoutes } from "./routes/services";
import { appointmentRoutes } from "./routes/appointments";
import { barberRoutes } from "./routes/barbers";
import { comandaRoutes } from "./routes/comandas";
import { adminRoutes } from "./routes/admin";
import { paymentRoutes } from "./routes/payments";
import { startTokenCleanupJob } from "./jobs/cleanupTokens";
import { mapPrismaErrorToHttp } from "./lib/prismaError";

const PORT = Number(process.env.PORT) || 3333;
const isDev = process.env.NODE_ENV !== "production";

const app = new Elysia()
  .onBeforeHandle(({ set }) => {
    const headers = set.headers as Record<string, string>;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";

    if (!isDev) {
      headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
    }

    headers["X-Powered-By"] = "";
    headers["X-XSS-Protection"] = "1; mode=block";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
  })
  .use(
    cors({
      origin:
        process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ??
        (isDev ? ["http://localhost:5173"] : []),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use(
    isDev
      ? swagger({
          documentation: {
            info: {
              title: "The House Barber API",
              version: "1.0.0",
              description: "Sistema de agendamento para barbearia",
            },
            tags: [
              { name: "Auth", description: "Autenticação e autorização" },
              { name: "Services", description: "Serviços da barbearia" },
              { name: "Appointments", description: "Agendamentos" },
              { name: "Barbers", description: "Barbeiros" },
              { name: "Comandas", description: "Gestão de comandas" },
              { name: "Admin", description: "Painel administrativo" },
              { name: "Payments", description: "Pagamentos PIX" },
            ],
          },
        })
      : new Elysia()
  )
  .get(
    "/healthcheck",
    () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "the-house-barber-api",
      version: "1.0.0",
    }),
    { detail: { tags: ["System"], summary: "Health check endpoint" } }
  )
  .use(authRoutes)
  .use(serviceRoutes)
  .use(appointmentRoutes)
  .use(barberRoutes)
  .use(comandaRoutes)
  .use(adminRoutes)
  .use(paymentRoutes)
  .onError(({ code, error, set }) => {
    console.error(`[Error ${code}]:`, error);

    const prismaMapped = mapPrismaErrorToHttp(error);
    if (prismaMapped) {
      set.status = prismaMapped.status;
      return prismaMapped.body;
    }

    if (code === "VALIDATION") {
      set.status = 422;
      return { error: "Validation Error", details: error.message };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Route not found" };
    }

    set.status = 500;
    return {
      error: "Internal Server Error",
      message: isDev ? error.message : undefined,
    };
  })
  .listen({ port: PORT, hostname: "0.0.0.0" });

startTokenCleanupJob();

console.log(`🚀 The House Barber API running at http://localhost:${PORT}`);
if (isDev) {
  console.log(`📚 Swagger docs at http://localhost:${PORT}/swagger`);
}
console.log("🗄️ DB:", process.env.DATABASE_URL);

export type App = typeof app;
