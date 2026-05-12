import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, PaymentStatus } from "@reservasi/db";
import { customerConfirmationMessage, sendWhatsApp } from "../services/whatsapp.js";
import { requireRestaurantAccess } from "../services/auth.js";

const restaurantParams = z.object({ restaurantId: z.string().min(1) });
const menuParams = z.object({ restaurantId: z.string().min(1), menuItemId: z.string().min(1) });
const reservationParams = z.object({ reservationId: z.string().min(1) });

const settingsBody = z.object({
  dpPercentage: z.number().int().min(0).max(100).optional(),
  maxPartySize: z.number().int().min(1).max(500).optional(),
  slotDurationMinute: z.number().int().min(15).max(360).optional(),
  closedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(120).optional(),
  operatingHours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        openTime: z.string().regex(/^\d{2}:\d{2}$/),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/),
        isClosed: z.boolean()
      })
    )
    .refine((hours) => hours.length === 0 || hours.length === 7, "Jam operasional harus berisi 7 hari.")
    .optional(),
  qrisImageUrl: z
    .union([
      z.string().url(),
      z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,/)
    ])
    .optional()
    .or(z.literal("")),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  cashInstruction: z.string().optional()
});

const slotBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().min(1).max(500),
  isBlocked: z.boolean().default(false)
});

const MAX_MENU_IMAGE_BYTES = 30 * 1024;

function dataUrlBytes(value: string) {
  const base64 = value.split(",")[1] ?? "";
  const padding = (base64.match(/=+$/)?.[0].length ?? 0);
  return Math.floor((base64.length * 3) / 4) - padding;
}

const menuImageSchema = z
  .union([
    z.string().url(),
    z.string().regex(/^data:image\/(png|jpeg|jpg|webp);base64,/)
  ])
  .refine((value) => !value.startsWith("data:image/") || dataUrlBytes(value) <= MAX_MENU_IMAGE_BYTES, {
    message: "Ukuran gambar menu maksimal 30KB."
  });

const menuBody = z.object({
  name: z.string().min(2),
  description: z.string().min(2),
  category: z.string().min(2),
  labels: z.array(z.string().min(1)).max(12).default([]),
  price: z.number().int().min(0),
  isAvailable: z.boolean().default(true),
  imageUrl: menuImageSchema.optional().or(z.literal(""))
});

function receiptUrl(code: string) {
  return `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/receipt/${code}`;
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/restaurants/:restaurantId/dashboard", async (request, reply) => {
    const { restaurantId } = restaurantParams.parse(request.params);
    const session = await requireRestaurantAccess(request, reply, restaurantId);
    if (!session) return;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        reservations: {
          orderBy: { createdAt: "desc" },
          take: 25,
          include: { items: true, payment: true }
        },
        menuItems: { orderBy: [{ category: "asc" }, { name: "asc" }] },
        operatingHours: { orderBy: { dayOfWeek: "asc" } },
        reservationSlots: { orderBy: [{ date: "asc" }, { time: "asc" }], take: 80 }
      }
    });

    if (!restaurant) {
      return reply.code(404).send({ message: "Restoran tidak ditemukan." });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayReservations = restaurant.reservations.filter(
      (reservation) => reservation.reservationAt >= today
    );
    const reviewCount = restaurant.reservations.filter(
      (reservation) => reservation.payment?.status === PaymentStatus.PENDING_REVIEW
    ).length;
    const paidReservations = restaurant.reservations.filter(
      (reservation) => reservation.payment?.status === PaymentStatus.PAID || reservation.payment?.status === PaymentStatus.PARTIALLY_PAID
    );
    const totalRevenue = paidReservations.reduce((sum, reservation) => sum + (reservation.payment?.amountPaid ?? 0), 0);
    const grossSales = paidReservations.reduce((sum, reservation) => sum + reservation.subtotal, 0);

    return {
      restaurant,
      metrics: {
        upcomingReservations: todayReservations.length,
        pendingPaymentReviews: reviewCount,
        menuCount: restaurant.menuItems.length,
        slotCount: restaurant.reservationSlots.length,
        transactionRevenue: totalRevenue,
        grossSales,
        estimatedProfit: totalRevenue,
        paidTransactionCount: paidReservations.length
      }
    };
  });

  app.patch("/restaurants/:restaurantId/settings", async (request, reply) => {
    const { restaurantId } = restaurantParams.parse(request.params);
    const session = await requireRestaurantAccess(request, reply, restaurantId);
    if (!session) return;

    const body = settingsBody.parse(request.body);
    const { operatingHours, qrisImageUrl, ...restaurantSettings } = body;

    const restaurant = await prisma.$transaction(async (tx) => {
      const updated = await tx.restaurant.update({
        where: { id: restaurantId },
        data: {
          ...restaurantSettings,
          ...(qrisImageUrl !== undefined ? { qrisImageUrl: qrisImageUrl || null } : {})
        }
      });

      if (operatingHours?.length) {
        for (const hour of operatingHours) {
          await tx.operatingHour.upsert({
            where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek: hour.dayOfWeek } },
            update: { openTime: hour.openTime, closeTime: hour.closeTime, isClosed: hour.isClosed },
            create: { restaurantId, dayOfWeek: hour.dayOfWeek, openTime: hour.openTime, closeTime: hour.closeTime, isClosed: hour.isClosed }
          });
        }
      }

      return tx.restaurant.findUnique({
        where: { id: updated.id },
        include: { operatingHours: { orderBy: { dayOfWeek: "asc" } } }
      });
    });

    return restaurant;
  });

  app.post("/restaurants/:restaurantId/slots", async (request, reply) => {
    const { restaurantId } = restaurantParams.parse(request.params);
    const session = await requireRestaurantAccess(request, reply, restaurantId);
    if (!session) return;

    const body = slotBody.parse(request.body);
    const slot = await prisma.reservationSlot.upsert({
      where: {
        restaurantId_date_time: {
          restaurantId,
          date: new Date(`${body.date}T00:00:00.000Z`),
          time: body.time
        }
      },
      update: {
        capacity: body.capacity,
        isBlocked: body.isBlocked
      },
      create: {
        restaurantId,
        date: new Date(`${body.date}T00:00:00.000Z`),
        time: body.time,
        capacity: body.capacity,
        isBlocked: body.isBlocked
      }
    });

    return slot;
  });

  app.post("/restaurants/:restaurantId/menu", async (request, reply) => {
    const { restaurantId } = restaurantParams.parse(request.params);
    const session = await requireRestaurantAccess(request, reply, restaurantId);
    if (!session) return;

    const body = menuBody.parse(request.body);
    const menu = await prisma.menuItem.create({
      data: {
        restaurantId,
        name: body.name,
        description: body.description,
        category: body.category,
        labels: Array.from(new Set(body.labels.map((label) => label.trim()).filter(Boolean))),
        price: body.price,
        isAvailable: body.isAvailable,
        imageUrl: body.imageUrl || null
      }
    });

    return reply.code(201).send(menu);
  });

  app.patch("/restaurants/:restaurantId/menu/:menuItemId", async (request, reply) => {
    const { restaurantId, menuItemId } = menuParams.parse(request.params);
    const session = await requireRestaurantAccess(request, reply, restaurantId);
    if (!session) return;

    const existing = await prisma.menuItem.findFirst({ where: { id: menuItemId, restaurantId } });
    if (!existing) {
      return reply.code(404).send({ message: "Menu tidak ditemukan." });
    }

    const body = menuBody.parse(request.body);
    const menu = await prisma.menuItem.update({
      where: { id: menuItemId },
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        labels: Array.from(new Set(body.labels.map((label) => label.trim()).filter(Boolean))),
        price: body.price,
        isAvailable: body.isAvailable,
        imageUrl: body.imageUrl || null
      }
    });

    return menu;
  });

  app.get("/restaurants/:restaurantId/reservations", async (request, reply) => {
    const { restaurantId } = restaurantParams.parse(request.params);
    const session = await requireRestaurantAccess(request, reply, restaurantId);
    if (!session) return;

    const reservations = await prisma.reservation.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      include: { items: true, payment: true }
    });

    return { reservations };
  });

  app.post("/reservations/:reservationId/approve-payment", async (request, reply) => {
    const { reservationId } = reservationParams.parse(request.params);
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { restaurant: true, payment: true }
    });

    if (!reservation || !reservation.payment) {
      return reply.code(404).send({ message: "Reservasi atau pembayaran tidak ditemukan." });
    }

    const session = await requireRestaurantAccess(request, reply, reservation.restaurantId);
    if (!session) return;

    const status = reservation.payment.type === "DP" ? "PARTIALLY_PAID" : "PAID";
    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: "CONFIRMED",
        receiptUrl: reservation.receiptUrl ?? receiptUrl(reservation.code),
        payment: {
          update: {
            status,
            amountPaid: reservation.payment.amountDue,
            reviewedAt: new Date()
          }
        }
      },
      include: { restaurant: true, items: true, payment: true }
    });

    await sendWhatsApp({
      to: reservation.customerPhone,
      message: customerConfirmationMessage({
        restaurantName: reservation.restaurant.name,
        reservationCode: reservation.code,
        receiptUrl: updated.receiptUrl ?? receiptUrl(reservation.code)
      })
    });

    return updated;
  });

  app.post("/reservations/:reservationId/reject-payment", async (request, reply) => {
    const { reservationId } = reservationParams.parse(request.params);
    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { payment: true } });
    if (!reservation || !reservation.payment) {
      return reply.code(404).send({ message: "Reservasi atau pembayaran tidak ditemukan." });
    }

    const session = await requireRestaurantAccess(request, reply, reservation.restaurantId);
    if (!session) return;

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "REJECTED",
        payment: {
          update: {
            status: "REJECTED",
            reviewedAt: new Date()
          }
        }
      },
      include: { restaurant: true, items: true, payment: true }
    });

    return updated;
  });
}
