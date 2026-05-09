import * as bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@reservasi/db";
import { requireAuth } from "../services/auth.js";

const createRestaurantBody = z.object({
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPhone: z.string().min(8),
  ownerPassword: z.string().min(8).optional().or(z.literal("")),
  restaurantName: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(5),
  address: z.string().min(5),
  phone: z.string().min(5),
  whatsappNumber: z.string().min(8)
});

const restaurantParams = z.object({ restaurantId: z.string().min(1) });

const restaurantStatusBody = z.object({
  isActive: z.boolean()
});

const userPublicSelect = {
  id: true,
  role: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true
} as const;

const paidStatuses = new Set(["PARTIALLY_PAID", "PAID"]);

export async function superAdminRoutes(app: FastifyInstance) {
  app.get("/dashboard", async (request, reply) => {
    const session = await requireAuth(request, reply, ["SUPER_ADMIN"]);
    if (!session) return;

    const [restaurants, transactions] = await Promise.all([
      prisma.restaurant.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: userPublicSelect },
          admins: { include: { user: { select: userPublicSelect } } },
          reservations: {
            include: { payment: true }
          }
        }
      }),
      prisma.reservation.findMany({
        where: { payment: { isNot: null } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { restaurant: true, payment: true, items: true }
      })
    ]);

    const restaurantSummaries = restaurants.map((restaurant) => {
      const paidReservations = restaurant.reservations.filter((reservation) =>
        reservation.payment ? paidStatuses.has(reservation.payment.status) : false
      );
      const totalRevenue = paidReservations.reduce((sum, reservation) => sum + (reservation.payment?.amountPaid ?? 0), 0);
      const grossSales = paidReservations.reduce((sum, reservation) => sum + reservation.subtotal, 0);

      return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        address: restaurant.address,
        whatsappNumber: restaurant.whatsappNumber,
        isActive: restaurant.isActive,
        owner: restaurant.owner,
        admins: restaurant.admins,
        reservationCount: restaurant.reservations.length,
        paidReservationCount: paidReservations.length,
        totalRevenue,
        grossSales,
        estimatedProfit: totalRevenue
      };
    });

    const totalRevenue = restaurantSummaries.reduce((sum, restaurant) => sum + restaurant.totalRevenue, 0);
    const grossSales = restaurantSummaries.reduce((sum, restaurant) => sum + restaurant.grossSales, 0);

    return {
      metrics: {
        restaurantCount: restaurants.length,
        activeRestaurantCount: restaurants.filter((restaurant) => restaurant.isActive).length,
        inactiveRestaurantCount: restaurants.filter((restaurant) => !restaurant.isActive).length,
        transactionCount: transactions.length,
        totalRevenue,
        grossSales,
        estimatedProfit: totalRevenue
      },
      restaurants: restaurantSummaries,
      transactions: transactions.map((reservation) => ({
        id: reservation.id,
        code: reservation.code,
        restaurantId: reservation.restaurantId,
        restaurantName: reservation.restaurant.name,
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        reservationAt: reservation.reservationAt,
        createdAt: reservation.createdAt,
        status: reservation.status,
        subtotal: reservation.subtotal,
        paymentAmount: reservation.paymentAmount,
        payment: reservation.payment,
        itemCount: reservation.items.reduce((sum, item) => sum + item.quantity, 0)
      }))
    };
  });

  app.get("/restaurants", async (request, reply) => {
    const session = await requireAuth(request, reply, ["SUPER_ADMIN"]);
    if (!session) return;

    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      include: { owner: { select: userPublicSelect }, admins: { include: { user: { select: userPublicSelect } } } }
    });

    return { restaurants };
  });

  app.post("/restaurants", async (request, reply) => {
    const session = await requireAuth(request, reply, ["SUPER_ADMIN"]);
    if (!session) return;

    const body = createRestaurantBody.parse(request.body);
    const existing = await prisma.$transaction(async (tx) => {
      const [emailUser, slugRestaurant] = await Promise.all([
        tx.user.findUnique({ where: { email: body.ownerEmail } }),
        tx.restaurant.findUnique({ where: { slug: body.slug } })
      ]);
      return { emailUser, slugRestaurant };
    });

    if (existing.emailUser) {
      return reply.code(409).send({ message: "Email admin sudah dipakai." });
    }

    if (existing.slugRestaurant) {
      return reply.code(409).send({ message: "Path resto sudah dipakai. Pilih path lain." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: {
          role: "RESTAURANT_ADMIN",
          name: body.ownerName,
          email: body.ownerEmail,
          phone: body.ownerPhone,
          passwordHash: await bcrypt.hash(body.ownerPassword || "change-me-123", 10)
        }
      });

      const restaurant = await tx.restaurant.create({
        data: {
          ownerId: owner.id,
          name: body.restaurantName,
          slug: body.slug,
          description: body.description,
          address: body.address,
          phone: body.phone,
          whatsappNumber: body.whatsappNumber
        }
      });

      await tx.adminProfile.create({
        data: {
          userId: owner.id,
          restaurantId: restaurant.id
        }
      });

      return {
        owner: {
          id: owner.id,
          role: owner.role,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          createdAt: owner.createdAt,
          updatedAt: owner.updatedAt
        },
        restaurant
      };
    });

    return reply.code(201).send(result);
  });

  app.patch("/restaurants/:restaurantId/status", async (request, reply) => {
    const session = await requireAuth(request, reply, ["SUPER_ADMIN"]);
    if (!session) return;

    const { restaurantId } = restaurantParams.parse(request.params);
    const body = restaurantStatusBody.parse(request.body);

    return prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isActive: body.isActive },
      include: { owner: { select: userPublicSelect }, admins: { include: { user: { select: userPublicSelect } } } }
    });
  });
}
