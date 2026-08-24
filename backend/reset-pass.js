require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function resetPass() {
  const userId = '4645bc91-2885-4e00-8cd5-be2bb00b0068';
  const newPass = 'password123';
  const hashed = await bcrypt.hash(newPass, 10);
  
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { password: hashed }
  });
  
  console.log('Password reset successful for user:', updated.name);
  console.log('Email to login with:', updated.email);
  console.log('New Password:', newPass);
}

resetPass().finally(() => prisma.$disconnect());
