import prisma from './src/prisma';

async function main() {
  try {
    console.log("Applying partial unique indexes for atomicity...");
    
    // Doctor double-booking prevention
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_doctor_slot" 
      ON "Appointment"("doctorId", "appointmentDate", "timeSlot") 
      WHERE "status" IN ('PENDING', 'CONFIRMED');
    `);
    
    // Patient double-booking prevention
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_patient_slot" 
      ON "Appointment"("patientId", "appointmentDate", "timeSlot") 
      WHERE "status" IN ('PENDING', 'CONFIRMED');
    `);
    
    console.log("Indexes applied successfully!");
  } catch (err) {
    console.error("Error applying indexes:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
