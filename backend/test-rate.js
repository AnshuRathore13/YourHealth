require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testRate() {
  const apt = await prisma.appointment.findFirst({
    where: { status: 'COMPLETED' },
    include: { patient: true }
  });

  if (!apt) {
    console.log("No completed appointments found.");
    return;
  }

  console.log(`Found apt ${apt.id} for patient ${apt.patient.id}`);
  
  // Generate a mock token exactly like backend/src/middlewares/auth.middleware.ts does?
  // Wait, I can just use the login logic or sign it directly.
  // Assuming process.env.JWT_SECRET is what it uses:
  const token = jwt.sign(
    { id: apt.patient.id, role: apt.patient.role || 'PATIENT' },
    process.env.JWT_SECRET || 'fallback-secret', // Let's hope it's not a fallback
    { expiresIn: '1d' }
  );

  console.log("Token:", token);

  try {
    const res = await fetch(`http://localhost:5000/api/patient/appointments/${apt.id}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rating: 5 })
    });
    
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch(e) {
    console.error("Fetch error:", e);
  }
}

testRate().finally(() => prisma.$disconnect());
