import "dotenv/config";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { ZodError } from "zod";
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

function formatZodIssue(path: string, message: string) {
  const labels: Record<string, string> = {
    customerName: "Nama customer",
    customerPhone: "Nomor WhatsApp",
    customerEmail: "Email receipt",
    partySize: "Jumlah tamu",
    date: "Tanggal",
    time: "Jam tersedia",
    contactPerson: "Kontak person",
    ownerName: "Nama admin",
    ownerEmail: "Email login admin",
    ownerPhone: "No. HP admin",
    ownerPassword: "Password awal admin",
    restaurantName: "Nama resto",
    slug: "Path resto",
    description: "Deskripsi",
    address: "Alamat",
    phone: "No. telepon / WhatsApp resto",
    whatsappNumber: "WhatsApp resto",
    operatingHours: "Jam operasional",
    closedDates: "Tanggal libur"
  };
  const label = labels[path] ?? path;
  const lowerMessage = message.toLowerCase();

  if (path === "customerName") return "Nama customer minimal 2 karakter.";
  if (path === "customerPhone") return "Nomor WhatsApp minimal 8 digit.";
  if (path === "customerEmail") return "Email receipt belum valid.";
  if (lowerMessage.includes("required")) return `${label} wajib diisi.`;
  return message.startsWith(label) ? message : `${label}: ${message}`;
}

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => formatZodIssue(String(issue.path[0] ?? "form"), issue.message));
    reply.code(400).send({
      message: "Data belum lengkap atau belum valid.",
      details
    });
    return;
  }

  request.log.error(error);
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 500;
  const message = error instanceof Error ? error.message : "Request gagal.";
  reply.code(statusCode).send({
    message: statusCode < 500 ? message : "Terjadi kendala di server. Silakan coba lagi."
  });
});

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
