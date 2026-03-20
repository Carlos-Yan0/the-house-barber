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
import { keepAlive } from "./utils/keepAlive";

const PORT = Number(process.env.PORT) || 3333;

const app = new Elysia()
  .use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:5173"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use(
    swagger({
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
        ],
      },
    })
  )

  // Health check - anti cold-start
  .get(
    "/healthcheck",
    () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "the-house-barber-api",
      version: "1.0.0",
    }),
    {
      detail: { tags: ["System"], summary: "Health check endpoint" },
    }
  )

  // API routes
  .use(authRoutes)
  .use(serviceRoutes)
  .use(appointmentRoutes)
  .use(barberRoutes)
  .use(comandaRoutes)
  .use(adminRoutes)

  .onError(({ code, error, set }) => {
    console.error(`[Error ${code}]:`, error);

    if (code === "VALIDATION") {
      set.status = 422;
      return {
        error: "Validation Error",
        details: error.message,
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Route not found" };
    }

    set.status = 500;
    return {
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    };
  })

  .listen(PORT);

console.log(
  `🚀 The House Barber API running at http://localhost:${PORT}`
);
console.log(`📚 Swagger docs at http://localhost:${PORT}/swagger`);

// Start keep-alive ping for Render free tier
if (process.env.NODE_ENV === "production") {
  keepAlive();
}

export type App = typeof app;
