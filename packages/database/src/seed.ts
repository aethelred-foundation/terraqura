import prisma from "./prisma/index.js";

async function seed() {
  // Keep seed idempotent and safe for empty bootstrap runs.
  await prisma.$connect();
  await prisma.$disconnect();
}

seed().catch(async (error) => {
  console.error("Database seed failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
