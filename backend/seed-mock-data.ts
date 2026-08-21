import prisma from './src/prisma';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log("Seeding mock data...");

  // Create Patient
  const passwordHash = await bcrypt.hash('password123!', 10);
  let patient = await prisma.user.findUnique({ where: { email: 'testpatient@yourhealth.ai' } });
  if (!patient) {
    patient = await prisma.user.create({
      data: {
        email: 'testpatient@yourhealth.ai',
        password: passwordHash,
        name: 'Test Patient',
        role: 'PATIENT',
        phone: '1234567890',
        dob: '1990-01-01',
        gender: 'Male',
        bloodGroup: 'O+',
        allergies: 'None',
        conditions: 'None'
      }
    });
    console.log("Created patient.");
  }

  // Create Doctor
  let doctor = await prisma.user.findUnique({ where: { email: 'doctor@yourhealth.ai' } });
  if (!doctor) {
    doctor = await prisma.user.create({
      data: {
        email: 'doctor@yourhealth.ai',
        password: passwordHash,
        name: 'Doctor Demo',
        role: 'DOCTOR',
        doctorProfile: {
          create: {
            specialization: 'General Physician',
            workingHours: { start: "09:00", end: "17:00" },
            slotDuration: 30,
            leaveDays: []
          }
        }
      }
    });
    console.log("Created doctor.");
  }

  // Create Appointments
  const today = new Date();
  
  const completedDate = new Date(today);
  completedDate.setDate(today.getDate() - 2);
  const completedKey = completedDate.toISOString().split('T')[0];

  const upcomingDate = new Date(today);
  upcomingDate.setDate(today.getDate() + 1);
  const upcomingKey = upcomingDate.toISOString().split('T')[0];

  await prisma.appointment.createMany({
    data: [
      {
        patientId: patient.id,
        doctorId: doctor.id,
        appointmentDate: completedKey,
        timeSlot: "10:00",
        status: "COMPLETED",
        urgencyLevel: "Low",
        symptoms: "Mild headache for 2 days",
        preVisitSummary: "Patient reports mild headache. No other symptoms.",
        postVisitNotes: "Patient has tension headache. Take Paracetamol 500mg twice daily for 3 days.",
        postVisitSummary: "Diagnosed with tension headache. Advised rest and hydration. Prescribed Paracetamol."
      },
      {
        patientId: patient.id,
        doctorId: doctor.id,
        appointmentDate: upcomingKey,
        timeSlot: "14:30",
        status: "CONFIRMED",
        urgencyLevel: "Medium",
        symptoms: "Follow-up visit",
        preVisitSummary: "Follow-up appointment for recent tension headache."
      }
    ]
  });
  console.log("Created 2 appointments.");

  console.log("Seed complete.");
}

seed().catch(console.error).finally(() => prisma.$disconnect());
