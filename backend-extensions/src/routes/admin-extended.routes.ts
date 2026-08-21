import { Router } from "express";
import prisma from "../prisma";
import bcrypt from "bcryptjs";
import { AuthRequest, authenticate, requireRole } from "../middlewares/auth.middleware";

// NOTE: NotificationQueue.status uses enum NotificationStatus { PENDING, FAILED, SENT }
// The updated schema.prisma renames SUCCESS -> SENT. If you haven't migrated yet,
// change "SENT" below to "SUCCESS" to match the original schema.

const router = Router();

// ——————————————————————————————————————
// GET /api/admin/stats
// ——————————————————————————————————————
router.get("/stats", authenticate, requireRole(["ADMIN"]), async (req, res): Promise<void> => {
  try {
    const [doctors, patients, appointments, cancelled, notifSent] = await Promise.all([
      prisma.user.count({ where: { role: "DOCTOR" } }),
      prisma.user.count({ where: { role: "PATIENT" } }),
      prisma.appointment.count(),
      prisma.appointment.count({ where: { status: "CANCELLED" } }),
      // Use "SENT" after schema migration; use "SUCCESS" if using original schema
      prisma.notificationQueue.count({ where: { status: "SENT" as any } }),
    ]);

    res.json({ doctors, patients, appointments, cancelled, emailsSent: notifSent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/admin/doctors
// ——————————————————————————————————————
router.get("/doctors", authenticate, requireRole(["ADMIN"]), async (req, res): Promise<void> => {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } }
    });
    const shaped = doctors.map(d => ({
      id:             d.userId,
      name:           (d as any).user?.name || "",
      email:          (d as any).user?.email || "",
      specialisation: d.specialization,
      slotDuration:   d.slotDuration,
      fee:            (d as any).consultationFee || 500,
      experience:     (d as any).experience || 5,
      workStart:      ((d.workingHours as any)?.start) || "09:00",
      workEnd:        ((d.workingHours as any)?.end)   || "17:00",
      bio:            (d as any).bio || "",
    }));
    res.json({ data: shaped });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// POST /api/admin/doctors  — create doctor profile + user account
// ——————————————————————————————————————
router.post("/doctors", authenticate, requireRole(["ADMIN"]), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { name, email, specialisation, phone, slotDuration, fee, experience, workStart, workEnd, bio } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(400).json({ error: "Email already in use" }); return; }

    const tempPassword = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(tempPassword, 10);

    const user = await prisma.user.create({
      data: {
        email, name,
        password: hashed,
        role: "DOCTOR",
        doctorProfile: {
          create: {
            specialization: specialisation,
            slotDuration:   slotDuration || 30,
            workingHours:   { start: workStart || "09:00", end: workEnd || "17:00" },
            leaveDays:      [],
            rating:         parseFloat((Math.random() * (5.0 - 4.0) + 4.0).toFixed(1)),
          }
        }
      },
      include: { doctorProfile: true }
    });

    // Queue welcome email with temp password
    await prisma.notificationQueue.create({
      data: { type: "EMAIL", payload: { userId: user.id, type: "DOCTOR_WELCOME", tempPassword } }
    });

    res.status(201).json({ data: user, message: `Doctor created. Credentials sent to ${email}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// PUT /api/admin/doctors/:id  — update doctor profile
// ——————————————————————————————————————
router.put("/doctors/:id", authenticate, requireRole(["ADMIN"]), async (req, res): Promise<void> => {
  try {
    const { name, specialisation, slotDuration, fee, experience, workStart, workEnd, bio } = req.body;

    await prisma.user.update({
      where: { id: req.params.id },
      data: { name }
    });

    await prisma.doctorProfile.update({
      where: { userId: req.params.id },
      data: {
        specialization: specialisation,
        slotDuration:   slotDuration,
        workingHours:   { start: workStart || "09:00", end: workEnd || "17:00" },
      }
    });

    res.json({ message: "Doctor profile updated" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// DELETE /api/admin/doctors/:id
// ——————————————————————————————————————
router.delete("/doctors/:id", authenticate, requireRole(["ADMIN"]), async (req, res): Promise<void> => {
  try {
    // Cancel all future appointments first
    await prisma.appointment.updateMany({
      where: { doctorId: req.params.id, status: { in: ["CONFIRMED", "PENDING"] } },
      data:  { status: "CANCELLED" }
    });
    // Delete doctor profile + user
    await prisma.doctorProfile.delete({ where: { userId: req.params.id } });
    await prisma.user.delete({ where: { id: req.params.id } });

    res.json({ message: "Doctor deleted" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/admin/appointments
// ——————————————————————————————————————
router.get("/appointments", authenticate, requireRole(["ADMIN"]), async (req, res): Promise<void> => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    const where: any = {};
    if (status) where.status = (status as string).toUpperCase();

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor:  { select: { name: true, doctorProfile: true } }
      },
      orderBy: [{ appointmentDate: "desc" }],
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const shaped = appointments.map(a => ({
      id:           a.id,
      patientName:  (a as any).patient?.name,
      doctorName:   (a as any).doctor?.name,
      datetime:     `${a.appointmentDate}T${a.timeSlot}:00`,
      status:       a.status.toLowerCase(),
      urgency:      (a as any).urgencyLevel || "Low",
      specialisation: (a as any).doctor?.doctorProfile?.specialization,
    }));

    res.json({ data: shaped, total: shaped.length });
  } catch (error) {
    console.error("GET /appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/admin/notification-logs
// ——————————————————————————————————————
router.get("/notification-logs", authenticate, requireRole(["ADMIN"]), async (req, res): Promise<void> => {
  try {
    const logs = await prisma.notificationQueue.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: logs });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/admin/users
// ——————————————————————————————————————
router.get("/users", authenticate, requireRole(["ADMIN"]), async (req, res): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json({ data: users });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
