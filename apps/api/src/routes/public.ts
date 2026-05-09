import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, PaymentMethod, PaymentType, ReservationStatus } from "@reservasi/db";
import { assertSlotAvailable, getAvailableSlots, reservationDateTime } from "../services/availability.js";
import { adminPaymentReviewMessage, sendWhatsApp } from "../services/whatsapp.js";

const restaurantParams = z.object({ slug: z.string().min(1) });
const reservationParams = z.object({ code: z.string().min(6) });

const availabilityBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.number().int().min(1).max(100)
});

const createReservationBody = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(8),
  customerEmail: z.string().email().optional().or(z.literal("")),
  contactPerson: z.string().min(2),
  sourceChannel: z.enum(["whatsapp", "instagram", "direct"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1).max(100),
  notes: z.string().optional()
});

const menuBody = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(99)
      })
    )
    .min(1)
});

const paymentBody = z.object({
  type: z.nativeEnum(PaymentType),
  method: z.nativeEnum(PaymentMethod)
});

const submitPaymentBody = z.object({
  proofUrl: z.string().url().optional().or(z.literal(""))
});

function reservationInclude() {
  return {
    restaurant: true,
    items: true,
    payment: true
  };
}

function makeCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RSV-${timestamp}-${random}`;
}

function receiptUrl(code: string) {
  return `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/receipt/${code}`;
}

export async function publicRoutes(app: FastifyInstance) {
  app.get("/restaurants/:slug", async (request, reply) => {
    const { slug } = restaurantParams.parse(request.params);
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      include: {
        menuItems: { where: { isAvailable: true }, orderBy: [{ category: "asc" }, { name: "asc" }] },
        operatingHours: { orderBy: { dayOfWeek: "asc" } }
      }
    });

    if (!restaurant || !restaurant.isActive) {
      return reply.notFound("Restoran tidak ditemukan.");
    }

    return restaurant;
  });

  app.post("/restaurants/:slug/availability", async (request, reply) => {
    const { slug } = restaurantParams.parse(request.params);
    const body = availabilityBody.parse(request.body);
    const restaurant = await prisma.restaurant.findUnique({ where: { slug } });

    if (!restaurant || !restaurant.isActive) {
      return reply.notFound("Restoran tidak ditemukan.");
    }

    const slots = await getAvailableSlots(restaurant.id, body.date, body.partySize);
    return { slots };
  });

  app.post("/restaurants/:slug/reservations", async (request, reply) => {
    const { slug } = restaurantParams.parse(request.params);
    const body = createReservationBody.parse(request.body);
    const restaurant = await prisma.restaurant.findUnique({ where: { slug } });

    if (!restaurant || !restaurant.isActive) {
      return reply.notFound("Restoran tidak ditemukan.");
    }

    if (body.partySize > restaurant.maxPartySize) {
      return reply.badRequest(`Maksimal tamu untuk reservasi online adalah ${restaurant.maxPartySize}.`);
    }

    await assertSlotAvailable(restaurant.id, body.date, body.time, body.partySize);

    const reservation = await prisma.reservation.create({
      data: {
        code: makeCode(),
        restaurantId: restaurant.id,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail || null,
        contactPerson: body.contactPerson,
        sourceChannel: body.sourceChannel,
        partySize: body.partySize,
        reservationAt: reservationDateTime(body.date, body.time),
        notes: body.notes,
        status: ReservationStatus.DRAFT
      },
      include: reservationInclude()
    });

    return reply.code(201).send(reservation);
  });

  app.get("/reservations/:code", async (request, reply) => {
    const { code } = reservationParams.parse(request.params);
    const reservation = await prisma.reservation.findUnique({
      where: { code },
      include: reservationInclude()
    });

    if (!reservation) {
      return reply.notFound("Reservasi tidak ditemukan.");
    }

    return reservation;
  });

  app.patch("/reservations/:code/menu", async (request, reply) => {
    const { code } = reservationParams.parse(request.params);
    const body = menuBody.parse(request.body);
    const reservation = await prisma.reservation.findUnique({ where: { code } });

    if (!reservation) {
      return reply.notFound("Reservasi tidak ditemukan.");
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        restaurantId: reservation.restaurantId,
        id: { in: body.items.map((item) => item.menuItemId) },
        isAvailable: true
      }
    });

    if (menuItems.length !== body.items.length) {
      return reply.badRequest("Sebagian menu tidak tersedia.");
    }

    const subtotal = body.items.reduce((total, requestedItem) => {
      const menu = menuItems.find((item) => item.id === requestedItem.menuItemId);
      return total + (menu?.price ?? 0) * requestedItem.quantity;
    }, 0);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.reservationItem.deleteMany({ where: { reservationId: reservation.id } });
      await tx.reservationItem.createMany({
        data: body.items.map((requestedItem) => {
          const menu = menuItems.find((item) => item.id === requestedItem.menuItemId);
          if (!menu) {
            throw new Error("Menu tidak ditemukan.");
          }

          return {
            reservationId: reservation.id,
            menuItemId: menu.id,
            nameSnapshot: menu.name,
            priceSnapshot: menu.price,
            quantity: requestedItem.quantity
          };
        })
      });

      return tx.reservation.update({
        where: { id: reservation.id },
        data: { subtotal },
        include: reservationInclude()
      });
    });

    return updated;
  });

  app.patch("/reservations/:code/payment", async (request, reply) => {
    const { code } = reservationParams.parse(request.params);
    const body = paymentBody.parse(request.body);
    const reservation = await prisma.reservation.findUnique({
      where: { code },
      include: { restaurant: true }
    });

    if (!reservation) {
      return reply.notFound("Reservasi tidak ditemukan.");
    }

    if (reservation.subtotal <= 0) {
      return reply.badRequest("Pilih menu terlebih dahulu sebelum memilih pembayaran.");
    }

    const amountDue =
      body.type === "DP"
        ? Math.ceil((reservation.subtotal * reservation.restaurant.dpPercentage) / 100)
        : reservation.subtotal;

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: "AWAITING_PAYMENT",
        paymentAmount: amountDue,
        payment: {
          upsert: {
            create: {
              type: body.type,
              method: body.method,
              amountDue
            },
            update: {
              type: body.type,
              method: body.method,
              amountDue,
              status: "UNPAID",
              proofUrl: null
            }
          }
        }
      },
      include: reservationInclude()
    });

    return updated;
  });

  app.post("/reservations/:code/submit-payment", async (request, reply) => {
    const { code } = reservationParams.parse(request.params);
    const body = submitPaymentBody.parse(request.body);
    const reservation = await prisma.reservation.findUnique({
      where: { code },
      include: { restaurant: true, payment: true }
    });

    if (!reservation || !reservation.payment) {
      return reply.notFound("Data pembayaran tidak ditemukan.");
    }

    const paymentStatus = reservation.payment.method === "CASH" ? "UNPAID" : "PENDING_REVIEW";
    const reservationStatus = reservation.payment.method === "CASH" ? "AWAITING_PAYMENT" : "PAYMENT_REVIEW";

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: reservationStatus,
        receiptUrl: receiptUrl(reservation.code),
        payment: {
          update: {
            status: paymentStatus,
            proofUrl: body.proofUrl || null
          }
        }
      },
      include: reservationInclude()
    });

    await sendWhatsApp({
      to: reservation.restaurant.whatsappNumber,
      message: adminPaymentReviewMessage({
        restaurantName: reservation.restaurant.name,
        reservationCode: reservation.code,
        adminUrl: `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/admin`
      })
    });

    return updated;
  });
}
