import { PrismaClient } from "@prisma/client";

/**
 * Next.js hot-reloads modules in dev, which would otherwise spawn a new pool on
 * every save until Postgres refuses connections. Cache the client on globalThis.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
