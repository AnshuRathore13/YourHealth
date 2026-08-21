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
      postVisitSummary: a.postVisitSummary || "",
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
      select: { id: true, postVisitNotes: true, appointmentDate: true },
      orderBy: { appointmentDate: "desc" }
    });

    // Parse simple prescriptions from notes
    const prescriptions = apts
      .filter(a => a.postVisitNotes)
      .map(a => ({
        id:        a.id,
        name:      extractMedName(a.postVisitNotes || ""),
        dosage:    extractDosage(a.postVisitNotes || ""),
        frequency: extractFrequency(a.postVisitNotes || ""),
        date:      a.appointmentDate,
      }));

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
// Helper: parse prescription text (simple heuristic)
// ——————————————————————————————————————
function extractMedName(notes: string): string {
  const match = notes.match(/(?:prescribed|take|medication)[\s:]+([A-Z][a-z]+ \d+mg)/i);
  return match ? match[1] : "Prescribed medication";
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
