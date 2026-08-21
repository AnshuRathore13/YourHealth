import prisma from './src/prisma';

async function fixRatings() {
  const doctors = await prisma.doctorProfile.findMany();
  for (const doc of doctors) {
    if (doc.rating === 4.5) {
      const newRating = parseFloat((Math.random() * (5.0 - 4.0) + 4.0).toFixed(1));
      await prisma.doctorProfile.update({
        where: { userId: doc.userId },
        data: { rating: newRating }
      });
      console.log(`Updated doctor ${doc.userId} rating to ${newRating}`);
    }
  }
  console.log("Done fixing ratings.");
}

fixRatings().catch(console.error).finally(() => prisma.$disconnect());
