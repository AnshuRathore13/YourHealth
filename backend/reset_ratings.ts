import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.doctorProfile.updateMany({
    data: {
      rating: 0,
      numRatings: 0,
    },
  });
  console.log(`Updated ${result.count} doctor profiles, resetting ratings to 0.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
