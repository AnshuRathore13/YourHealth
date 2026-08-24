require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  const docs = await prisma.doctorProfile.findMany();
  for (const doc of docs) {
    console.log(`Doctor ${doc.userId} -> ${JSON.stringify(doc.workingHours)}`);
  }
}

test().finally(() => prisma.$disconnect());
