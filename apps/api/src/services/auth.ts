import * as crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@reservasi/db";
import type { Role } from "@prisma/client";

export type AuthSession = {
  userId: string;
  email: string;
  role: Role;
  restaurantId: string | null;
};

type TokenPayload = AuthSession & { exp: number };

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

function secret() {
  return process.env.AUTH_SECRET || "reservasi-local-dev-secret-change-me";
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(content: string) {
  return crypto.createHmac("sha256", secret()).update(content).digest("base64url");
}

export function createAuthToken(session: AuthSession) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ ...session, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS } satisfies TokenPayload));
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export function verifyAuthToken(token: string): AuthSession | null {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = sign(`${header}.${payload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      userId: parsed.userId,
      email: parsed.email,
      role: parsed.role,
      restaurantId: parsed.restaurantId ?? null
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply, roles?: Role[]) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  const session = token ? verifyAuthToken(token) : null;

  if (!session) {
    reply.code(401).send({ message: "Login dibutuhkan." });
    return null;
  }

  if (roles && !roles.includes(session.role)) {
    reply.code(403).send({ message: "Akses tidak diizinkan." });
    return null;
  }

  return session;
}

export async function requireRestaurantAccess(request: FastifyRequest, reply: FastifyReply, restaurantId: string) {
  const session = await requireAuth(request, reply, ["SUPER_ADMIN", "RESTAURANT_ADMIN"]);
  if (!session) return null;

  if (session.role === "SUPER_ADMIN") return session;
  const adminProfile = await prisma.adminProfile.findUnique({ where: { userId: session.userId } });
  if (!adminProfile || adminProfile.restaurantId !== restaurantId) {
    reply.code(403).send({ message: "Admin resto tidak punya akses ke resto ini." });
    return null;
  }

  return session;
}
