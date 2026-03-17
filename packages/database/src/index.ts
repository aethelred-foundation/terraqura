// TerraQura Database Package
// Enterprise-grade data layer with TimescaleDB and Prisma

export * from "./timescale/index.js";
export * from "./prisma/index.js";

// Re-export Prisma client (generated)
export { PrismaClient } from "@prisma/client";
export type * from "@prisma/client";
