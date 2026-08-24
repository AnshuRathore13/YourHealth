import { Router } from "express";
import prisma from "../prisma";
import { AuthRequest, authenticate, requireRole } from "../middlewares/auth.middleware";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key_for_placement";

// ——————————————————————————————————————
// GET /api/appointments  — patient: own appointments; doctor: their schedule; admin: all
// ——————————————————————————————————————
router.get("/", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { status, date, limit = "50", offset = "0" } = req.query;
    const user = req.user!;

    let where: any = {};

    if (user.role === "PATIENT") {
      where.patientId = user.id;
    } else if (user.role === "DOCTOR") {
      where.doctorId = user.id;
    }
    // ADMIN sees all

    if (status) where.status = (status as string).toUpperCase();
    if (date)   where.appointmentDate = date as string;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor:  { select: { id: true, name: true, email: true } }
      },
      orderBy: [{ appointmentDate: "asc" }, { timeSlot: "asc" }],
      take:   parseInt(limit as string),
      skip:   parseInt(offset as string),
    });

    res.json({ data: appointments, total: appointments.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/appointments/:id
// ——————————————————————————————————————
router.get("/:id", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const apt = await prisma.appointment.findUnique({
      where: { id: (req.params.id as string) },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor:  { select: { id: true, name: true, email: true } }
      }
    });
    if (!apt) { res.status(404).json({ error: "Appointment not found" }); return; }
    res.json(apt);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// POST /api/appointments  — combined hold + confirm with AI (frontend unified endpoint)
// ——————————————————————————————————————
router.post("/", authenticate, requireRole(["PATIENT"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { doctorId, date, time, symptoms, preVisitSummary, urgency } = req.body;
    const patientId = req.user!.id;

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    try {
      // 1. Check if patient already has a non-cancelled appointment at this date/time
      const patientConflict = await prisma.appointment.findFirst({
        where: {
          patientId,
          appointmentDate: date,
          timeSlot: time,
          status: { in: ["CONFIRMED", "PENDING"] }
        }
      });
      if (patientConflict) {
        res.status(409).json({ error: "You already have an appointment scheduled at this time." });
        return;
      }

      // 2. Check if doctor already has a non-cancelled appointment at this date/time
      const doctorConflict = await prisma.appointment.findFirst({
        where: {
          doctorId,
          appointmentDate: date,
          timeSlot: time,
          status: { in: ["CONFIRMED", "PENDING"] }
        }
      });
      if (doctorConflict) {
        res.status(409).json({ error: "This slot is no longer available. Please select another time." });
        return;
      }

      const appointment = await prisma.appointment.create({
        data: {
          patientId,
          doctorId,
          appointmentDate: date,
          timeSlot: time,
          status: "CONFIRMED",
          symptoms: symptoms || "",
          preVisitSummary: preVisitSummary || "",
          urgencyLevel: urgency || "Low",
          expiresAt: null,
        }
      });

      // Queue confirmation email + calendar event
      await prisma.notificationQueue.createMany({
        data: [
          { type: "EMAIL",    payload: { appointmentId: appointment.id, type: "BOOKING_CONFIRMATION" } },
          { type: "CALENDAR", payload: { appointmentId: appointment.id, type: "CREATE_EVENT" } },
        ]
      });

      res.status(201).json({ data: appointment, message: "Appointment booked successfully" });
    } catch (e: any) {
      if (e.code === "P2002") {
        res.status(409).json({ error: "Slot is no longer available — double-booking prevented" });
        return;
      }
      console.error(e);
      res.status(500).json({ error: "Internal server error during booking" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// PATCH /api/appointments/:id/cancel
// ——————————————————————————————————————
router.patch("/:id/cancel", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { reason } = req.body;
    const apt = await prisma.appointment.update({
      where: { id: (req.params.id as string) },
      data:  { status: "CANCELLED" }
    });

    await prisma.notificationQueue.create({
      data: { type: "EMAIL", payload: { appointmentId: apt.id, type: "CANCELLATION", reason } }
    });

    if ((apt as any).calendarEventId) {
      await prisma.notificationQueue.create({
        data: { type: "CALENDAR", payload: { eventId: (apt as any).calendarEventId, type: "CANCEL_EVENT" } }
      });
    }

    res.json({ data: apt, message: "Appointment cancelled" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// PATCH /api/appointments/:id/complete  — doctor submits notes inline
// ——————————————————————————————————————
router.patch("/:id/complete", authenticate, requireRole(["DOCTOR"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { notes, prescription } = req.body;

    // Import LLM service dynamically to avoid circular imports
    const { generatePostVisitSummary } = await import("../services/llm.service");
    const patientSummary = await generatePostVisitSummary(notes + (prescription ? `. Prescription: ${prescription}` : ""));

    const apt = await prisma.appointment.update({
      where: { id: (req.params.id as string) },
      data: {
        status: "COMPLETED",
        postVisitNotes: notes,
        postVisitSummary: patientSummary,
      }
    });

    await prisma.notificationQueue.create({
      data: { type: "EMAIL", payload: { appointmentId: apt.id, type: "POST_VISIT_SUMMARY" } }
    });

    res.json({ data: apt, patientSummary, message: "Notes submitted and AI summary generated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// PATCH /api/appointments/:id/reschedule
// ——————————————————————————————————————
router.patch("/:id/reschedule", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { date, time } = req.body;
    const apt = await prisma.appointment.update({
      where: { id: (req.params.id as string) },
      data: { appointmentDate: date, timeSlot: time, status: "CONFIRMED" }
    });

    await prisma.notificationQueue.createMany({
      data: [
        { type: "EMAIL",    payload: { appointmentId: apt.id, type: "RESCHEDULE" } },
        { type: "CALENDAR", payload: { appointmentId: apt.id, type: "UPDATE_EVENT" } },
      ]
    });

    res.json({ data: apt, message: "Appointment rescheduled" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
