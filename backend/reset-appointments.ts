import prisma from './src/prisma';

async function resetAppointments() {
  console.log("Wiping all appointments...");
  const apts = await prisma.appointment.deleteMany({});
  console.log(`Deleted ${apts.count} appointments.`);

  console.log("Wiping notification queue (optional cleanup)...");
  const notifs = await prisma.notificationQueue.deleteMany({});
  console.log(`Deleted ${notifs.count} notification logs.`);

  console.log("Done!");
}

resetAppointments()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
