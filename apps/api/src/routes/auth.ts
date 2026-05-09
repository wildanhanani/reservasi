import * as bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@reservasi/db";
import { createAuthToken } from "../services/auth.js";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function publicUser(user: NonNullable<Awaited<ReturnType<typeof findUserForLogin>>>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    restaurantId: user.adminProfile?.restaurantId ?? null,
    restaurantSlug: user.adminProfile?.restaurant.slug ?? null,
    restaurantName: user.adminProfile?.restaurant.name ?? null
  };
}

function findUserForLogin(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      adminProfile: {
        include: { restaurant: true }
      }
    }
  });
}

async function verifyPassword(password: string, passwordHash: string) {
  if (passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$") || passwordHash.startsWith("$2y$")) {
    return bcrypt.compare(password, passwordHash);
  }

  return passwordHash === password;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const body = loginBody.parse(request.body);
    const user = await findUserForLogin(body.email);

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ message: "Email atau password salah." });
    }

    if (!user.passwordHash.startsWith("$2")) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(body.password, 10) }
      });
    }

    const cleanUser = publicUser(user);
    const token = createAuthToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.adminProfile?.restaurantId ?? null
    });

    return {
      token,
      user: cleanUser
    };
  });
}
