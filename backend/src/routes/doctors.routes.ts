import { Router } from "express";
import prisma from "../prisma";
import bcrypt from "bcryptjs";
import { AuthRequest, authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// ——————————————————————————————————————
// GET /api/doctors  — list all doctors (public)
// ——————————————————————————————————————
router.get("/", async (req, res): Promise<void> => {
  try {
    const { specialisation, name } = req.query;

    const where: any = {};
    if (specialisation) where.specialization = { contains: specialisation as string, mode: "insensitive" };

    const doctors = await prisma.doctorProfile.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } }
    });

    // Shape response to match frontend expectations
    const shaped = doctors.map(d => ({
      id:             d.userId,
      name:           (d as any).user?.name || "",
      email:          (d as any).user?.email || "",
      specialisation: d.specialization,
      slotDuration:   d.slotDuration,
      fee:            (d as any).consultationFee || 500,
      rating:         (d as any).rating || 0,
      numRatings:     (d as any).numRatings || 0,
      experience:     (d as any).experience || 5,
      workStart:      ((d.workingHours as any)?.start) || "09:00",
      workEnd:        ((d.workingHours as any)?.end)   || "17:00",
      bio:            (d as any).bio || "",
    }));

    res.json({ data: shaped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/doctors/:id — single doctor
// ——————————————————————————————————————
router.get("/:id", async (req, res): Promise<void> => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: (req.params.id as string) },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// GET /api/doctors/:id/availability?date=YYYY-MM-DD
// ——————————————————————————————————————
router.get("/:id/availability", async (req, res): Promise<void> => {
  try {
    const { date } = req.query;
    const doctorId = (req.params.id as string);

    if (!date) { res.status(400).json({ error: "date query param required" }); return; }

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: doctorId } });
    if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }

    // Check leave
    if (doctor.leaveDays.includes(date as string)) {
      res.json({ available: false, reason: "Doctor is on leave", slots: [] });
      return;
    }

    const booked = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: date as string,
        status: { in: ["PENDING", "CONFIRMED"] }
      }
    });

    const now = new Date();
    const bookedTimes = booked
      .filter(a => !(a.status === "PENDING" && a.expiresAt && a.expiresAt < now))
      .map(a => a.timeSlot);

    const wh = doctor.workingHours as any;
    const slots: { time: string; booked: boolean; passed?: boolean }[] = [];

    if (wh?.start && wh?.end) {
      let cur = new Date(`1970-01-01T${wh.start}:00Z`).getTime();
      const end = new Date(`1970-01-01T${wh.end}:00Z`).getTime();
      const dur = doctor.slotDuration * 60 * 1000;

      while (cur + dur <= end) {
        const raw   = new Date(cur).toISOString().substr(11, 5); // "09:00"
        const h24   = parseInt(raw.split(":")[0]);
        const min   = raw.split(":")[1];
        const ampm  = h24 >= 12 ? "PM" : "AM";
        const h12   = ((h24 % 12) || 12).toString().padStart(2, "0");
        const label = `${h12}:${min} ${ampm}`;
        
        const slotDate = new Date(`${date}T${raw}:00`);
        const isPassed = slotDate < new Date();
        
        slots.push({ 
          time: label, 
          booked: isPassed || bookedTimes.includes(label) || bookedTimes.includes(raw),
          passed: isPassed
        });
        cur += dur;
      }
    }

    res.json({ available: true, slots });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ——————————————————————————————————————
// POST /api/doctors/:id/leave  — doctor sets own leave
// ——————————————————————————————————————
router.post("/:id/leave", authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { dates } = req.body; // array of YYYY-MM-DD strings
    const doctorId = (req.params.id as string);

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: doctorId } });
    if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }

    const existing = new Set(doctor.leaveDays);
    (dates as string[]).forEach(d => existing.add(d));

    await prisma.doctorProfile.update({
      where: { userId: doctorId },
      data: { leaveDays: Array.from(existing) }
    });

    // Find and cancel affected appointments, queue notifications
    const affected = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: { in: dates as string[] },
        status: { in: ["CONFIRMED", "PENDING"] }
      }
    });

    for (const apt of affected) {
      await prisma.appointment.update({ where: { id: apt.id }, data: { status: "CANCELLED" } });
      await prisma.notificationQueue.create({
        data: { type: "EMAIL", payload: { appointmentId: apt.id, type: "DOCTOR_LEAVE_CANCELLATION" } }
      });
    }

    res.json({ message: `${dates.length} leave date(s) saved. ${affected.length} appointment(s) cancelled and patients notified.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
