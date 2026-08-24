require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function printDocs() {
  const docs = await prisma.doctorProfile.findMany({ include: { user: true } });
  docs.forEach(d => {
    console.log(`Doctor: ${d.user.name} | ID: ${d.userId} | Hours: ${JSON.stringify(d.workingHours)}`);
  });
}

printDocs().finally(() => prisma.$disconnect());
