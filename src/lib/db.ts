// Phase 1: in-memory store backed by mock-data. Phase 2: swap to Prisma.
// The API routes import from mock-data directly so `npm run build` works
// without a live Postgres. When DATABASE_URL is provisioned:
//   1. `npx prisma init`, add models Broker/Listing/Lead/Review/Report (see prisma/schema.prisma)
//   2. `npm i @prisma/client && npx prisma generate`
//   3. Replace the helpers below with a PrismaClient singleton.
export * from "./mock-data";
