import prisma from "./src/prisma";

async function run() {
  const res = await prisma.notificationQueue.updateMany({
    where: { status: 'FAILED' },
    data: { status: 'PENDING', retryCount: 0 }
  });
  console.log('Reset:', res);
}

run().finally(() => prisma.$disconnect());
