import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const apts = await prisma.appointment.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.log(apts.map(a => ({ id: a.id, date: a.appointmentDate, time: a.timeSlot })));
}
main().finally(() => prisma.$disconnect());
