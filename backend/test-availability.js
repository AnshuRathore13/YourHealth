require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
  const docProfile = await prisma.doctorProfile.findFirst();
  console.log("Doctor Profile:", docProfile);
  
  const res = await fetch(`http://localhost:5000/api/doctors/${docProfile.userId}/availability?date=2026-08-25`);
  const json = await res.json();
  console.log("Slots:", json.slots);
}

test().finally(() => prisma.$disconnect());
