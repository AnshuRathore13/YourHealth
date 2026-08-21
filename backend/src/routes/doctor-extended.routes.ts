import { Router } from "express";
import prisma from "../prisma";
import { AuthRequest, authenticate, requireRole } from "../middlewares/auth.middleware";
import { generatePostVisitSummary } from "../services/llm.service";

const router = Router();

// ——————————————————————————————————————
// GET /api/doctor/schedule?date=YYYY-MM-DD
// ——————————————————————————————————————
router.get("/schedule", authenticate, requireRole(["DOCTOR"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { date } = req.query;
    const where: any = { doctorId: req.user!.id };
    if (date) where.appointmentDate = date as string;

    const apts = await prisma.appointment.findMany({
      where,
      include: { patient: { select: { id: true, name: true, email: true } } },
      orderBy: { timeSlot: "asc" }
    });

    const shaped = apts.map(a => ({
      id:              a.id,
      appointmentDate: a.appointmentDate,
      timeSlot:        a.timeSlot,
      patientName:     (a as any).patient?.name || "",
      patientEmail:    (a as any).patient?.email || "",
      status:          a.status.toLowerCase(),
      urgency:         (a as any).urgencyLevel || "Low",
      preVisitSummary: a.preVisitSummary || "",
      postVisitSummary: a.postVisitSummary || null,
      symptoms:        a.symptoms || "",
    }));

    res.json({ data: shaped });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/doctor/profile
// ——————————————————————————————————————
router.get("/profile", authenticate, requireRole(["DOCTOR"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { doctorProfile: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/doctor/patients  — list unique patients seen
// ——————————————————————————————————————
router.get("/patients", authenticate, requireRole(["DOCTOR"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const apts = await prisma.appointment.findMany({
      where: { doctorId: req.user!.id, status: "COMPLETED" },
      include: { patient: { select: { id: true, name: true, email: true } } },
      distinct: ["patientId"],
    });
    res.json({ data: apts.map(a => (a as any).patient) });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// POST /api/doctor/appointments/:id/notes  — submit post-visit notes
// ——————————————————————————————————————
router.post("/appointments/:id/notes", authenticate, requireRole(["DOCTOR"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { notes, prescription, prescriptionFrequencyDays } = req.body;
    const doctorId = req.user!.id;
    const appointmentId = req.params.id;

    const apt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!apt || apt.doctorId !== doctorId) {
      res.status(404).json({ error: "Appointment not found" }); return;
    }

    const fullNotes = notes + (prescription ? `\n\nPrescription: ${prescription}` : "");
    const patientSummary = await generatePostVisitSummary(fullNotes);

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status:           "COMPLETED",
        postVisitNotes:   notes,
        postVisitSummary: patientSummary,
      }
    });

    const notifications: any[] = [
      { type: "EMAIL", payload: { appointmentId, type: "POST_VISIT_SUMMARY" } }
    ];

    if (prescriptionFrequencyDays && typeof prescriptionFrequencyDays === "number") {
      notifications.push({
        type: "EMAIL",
        payload: { appointmentId, type: "MEDICATION_REMINDER", days: prescriptionFrequencyDays }
      });
    }

    await prisma.notificationQueue.createMany({ data: notifications });

    res.json({ data: updated, patientSummary, message: "Notes submitted. AI summary generated and sent to patient." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/doctor/prescriptions
// ——————————————————————————————————————
router.get("/prescriptions", authenticate, requireRole(["DOCTOR"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const apts = await prisma.appointment.findMany({
      where: { doctorId: req.user!.id, status: "COMPLETED" },
      select: { id: true, postVisitNotes: true, appointmentDate: true, patient: { select: { name: true } } },
      orderBy: { appointmentDate: "desc" }
    });

    const prescriptions = apts
      .filter(a => a.postVisitNotes)
      .map(a => ({
        id:          a.id,
        patientName: a.patient.name,
        name:        extractMedName(a.postVisitNotes || ""),
        dosage:      extractDosage(a.postVisitNotes || ""),
        frequency:   extractFrequency(a.postVisitNotes || ""),
        date:        a.appointmentDate,
      }));

    res.json({ data: prescriptions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
