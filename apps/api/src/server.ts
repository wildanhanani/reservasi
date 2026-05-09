import "dotenv/config";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { publicRoutes } from "./routes/public.js";
import { superAdminRoutes } from "./routes/super-admin.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info"
  }
});

await app.register(cors, {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
});
await app.register(sensible);

app.get("/health", async () => ({
  status: "ok",
  service: "reservasi-api"
}));

await app.register(publicRoutes, { prefix: "/public" });
await app.register(authRoutes, { prefix: "/auth" });
await app.register(adminRoutes, { prefix: "/admin" });
await app.register(superAdminRoutes, { prefix: "/super-admin" });

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
