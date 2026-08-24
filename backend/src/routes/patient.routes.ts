import { Router } from "express";
import prisma from "../prisma";
import { AuthRequest, authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// ——————————————————————————————————————
// GET /api/patient/appointments
// ——————————————————————————————————————
router.get("/appointments", authenticate, requireRole(["PATIENT"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { status } = req.query;
    const where: any = { patientId: req.user!.id };
    if (status) {
      if ((status as string).toLowerCase() === "upcoming") {
        where.status = { in: ["PENDING", "CONFIRMED"] };
        const todayStr = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
        where.appointmentDate = { gte: todayStr };
      } else {
        where.status = (status as string).toUpperCase();
      }
    }

    const apts = await prisma.appointment.findMany({
      where,
      include: {
        doctor: { include: { doctorProfile: true } }
      },
      orderBy: [{ appointmentDate: "asc" }]
    });

    const shaped = apts.map(a => ({
      id:              a.id,
      appointmentDate: a.appointmentDate,
      timeSlot:        a.timeSlot,
      doctorName:      (a as any).doctor?.name || "",
      specialisation:  (a as any).doctor?.doctorProfile?.specialization || "General",
      status:          a.status.toLowerCase(),
      urgency:         (a as any).urgencyLevel || "Low",
      preVisitSummary: a.preVisitSummary || "",
      postVisitSummary: (() => {
        try {
          return JSON.parse(a.postVisitSummary || "{}").summary || a.postVisitSummary || "";
        } catch(e) {
          return a.postVisitSummary || "";
        }
      })(),
      symptoms:        a.symptoms || "",
      rating:          a.rating,
    }));

    res.json({ data: shaped });
  } catch (error) {
    console.error("GET /patient/appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/patient/prescriptions
// ——————————————————————————————————————
router.get("/prescriptions", authenticate, requireRole(["PATIENT"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    // Prescriptions are stored in completed appointments' postVisitNotes
    // In production this would be a separate Prescription model
    const apts = await prisma.appointment.findMany({
      where: { patientId: req.user!.id, status: "COMPLETED" },
      select: { id: true, postVisitSummary: true, appointmentDate: true, doctor: { select: { name: true } } },
      orderBy: { appointmentDate: "desc" }
    });

    // Parse simple prescriptions from notes
    const prescriptions = apts
      .filter(a => a.postVisitSummary && a.postVisitSummary.includes('"medication"'))
      .map(a => {
        let med = null;
        try {
          const summaryData = JSON.parse(a.postVisitSummary!);
          if (summaryData.medication) {
            med = summaryData.medication;
          }
        } catch (e) {
          // fallback if old format
        }
        
        return {
          id:        a.id,
          name:      med?.name || "Prescribed medication",
          dosage:    med?.dosage || "As prescribed",
          frequency: med?.frequency || "Daily",
          date:      a.appointmentDate,
          doctorName: (a as any).doctor?.name || "Doctor",
        };
      });

    res.json({ data: prescriptions });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/patient/reminders
// ——————————————————————————————————————
router.get("/reminders", authenticate, requireRole(["PATIENT"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const reminders = await prisma.notificationQueue.findMany({
      where: {
        type: "EMAIL",
        payload: { path: ["type"], equals: "MEDICATION_REMINDER" },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ data: reminders });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/patient/profile
// ——————————————————————————————————————
router.get("/profile", authenticate, requireRole(["PATIENT"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// POST /api/patient/appointments/:id/rate
// ——————————————————————————————————————
router.post("/appointments/:id/rate", authenticate, requireRole(["PATIENT"]), async (req: AuthRequest, res): Promise<any> => {
  try {
    const id = req.params.id as string;
    const ratingStr = req.body?.rating;
    
    if (!ratingStr || isNaN(Number(ratingStr))) {
      return res.status(400).json({ error: "Invalid rating" });
    }
    
    const rating = parseFloat(Number(ratingStr).toFixed(1));
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const apt = await prisma.appointment.findFirst({
      where: { id, patientId: req.user!.id },
      include: { doctor: { include: { doctorProfile: true } } }
    });

    if (!apt) return res.status(404).json({ error: "Appointment not found" });
    if (apt.status !== "COMPLETED") return res.status(400).json({ error: "Only completed appointments can be rated" });
    
    console.log(`[DEBUG] rating for ${id} is:`, apt.rating, typeof apt.rating);
    if (apt.rating !== null && apt.rating !== undefined) return res.status(400).json({ error: "Appointment already rated" });

    const docProfile = apt.doctor.doctorProfile;
    if (!docProfile) return res.status(404).json({ error: "Doctor profile not found" });

    const currentTotal = docProfile.rating * docProfile.numRatings;
    const newNumRatings = docProfile.numRatings + 1;
    const newRating = (currentTotal + rating) / newNumRatings;

    await prisma.$transaction([
      prisma.appointment.update({ where: { id }, data: { rating } }),
      prisma.doctorProfile.update({
        where: { id: docProfile.id },
        data: { rating: newRating, numRatings: newNumRatings }
      })
    ]);

    res.json({ success: true, rating: newRating, numRatings: newNumRatings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// Helper: parse prescription text (simple heuristic)
// ——————————————————————————————————————
function extractMedName(notes: string): string {
  const match = notes.match(/(?:prescription|prescribed|take|medication)[\s:]+([a-z\s\-]+ \d+mg)/i);
  return match ? match[1].trim() : "Prescribed medication";
}
function extractDosage(notes: string): string {
  const match = notes.match(/(\d+mg)/i);
  return match ? match[1] : "As prescribed";
}
function extractFrequency(notes: string): string {
  if (/twice daily/i.test(notes))  return "Twice daily";
  if (/once daily/i.test(notes))   return "Once daily";
  if (/thrice daily/i.test(notes)) return "Three times daily";
  if (/bedtime/i.test(notes))      return "Bedtime";
  return "Daily";
}

export default router;
