require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testPatch() {
  const doc = await prisma.doctorProfile.findFirst();
  const token = jwt.sign(
    { id: doc.userId, role: 'DOCTOR' },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '1d' }
  );

  const res = await fetch('http://localhost:5000/api/doctor/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      workingHours: { start: '09:00', end: '22:00' },
      slotDuration: 30
    })
  });

  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}

testPatch().finally(() => prisma.$disconnect());
