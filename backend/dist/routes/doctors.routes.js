"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// ——————————————————————————————————————
// GET /api/doctors  — list all doctors (public)
// ——————————————————————————————————————
router.get("/", async (req, res) => {
    try {
        const { specialisation, name } = req.query;
        const where = {};
        if (specialisation)
            where.specialization = { contains: specialisation, mode: "insensitive" };
        const doctors = await prisma_1.default.doctorProfile.findMany({
            where,
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { user: { name: "asc" } }
        });
        // Shape response to match frontend expectations
        const shaped = doctors.map(d => ({
            id: d.userId,
            name: d.user?.name || "",
            email: d.user?.email || "",
            specialisation: d.specialization,
            slotDuration: d.slotDuration,
            fee: d.consultationFee || 500,
            rating: d.rating || 0,
            numRatings: d.numRatings || 0,
            experience: d.experience || 5,
            workStart: (d.workingHours?.start) || "09:00",
            workEnd: (d.workingHours?.end) || "17:00",
            bio: d.bio || "",
        }));
        res.json({ data: shaped });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/doctors/:id — single doctor
// ——————————————————————————————————————
router.get("/:id", async (req, res) => {
    try {
        const doctor = await prisma_1.default.doctorProfile.findUnique({
            where: { userId: req.params.id },
            include: { user: { select: { id: true, name: true, email: true } } }
        });
        if (!doctor) {
            res.status(404).json({ error: "Doctor not found" });
            return;
        }
        res.json(doctor);
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/doctors/:id/availability?date=YYYY-MM-DD
// ——————————————————————————————————————
router.get("/:id/availability", async (req, res) => {
    try {
        const { date } = req.query;
        const doctorId = req.params.id;
        if (!date) {
            res.status(400).json({ error: "date query param required" });
            return;
        }
        const doctor = await prisma_1.default.doctorProfile.findUnique({ where: { userId: doctorId } });
        if (!doctor) {
            res.status(404).json({ error: "Doctor not found" });
            return;
        }
        // Check leave
        if (doctor.leaveDays.includes(date)) {
            res.json({ available: false, reason: "Doctor is on leave", slots: [] });
            return;
        }
        const booked = await prisma_1.default.appointment.findMany({
            where: {
                doctorId,
                appointmentDate: date,
                status: { in: ["PENDING", "CONFIRMED"] }
            }
        });
        const now = new Date();
        const bookedTimes = booked
            .filter(a => !(a.status === "PENDING" && a.expiresAt && a.expiresAt < now))
            .map(a => a.timeSlot);
        const wh = doctor.workingHours;
        const slots = [];
        if (wh?.start && wh?.end) {
            let cur = new Date(`1970-01-01T${wh.start}:00Z`).getTime();
            const end = new Date(`1970-01-01T${wh.end}:00Z`).getTime();
            const dur = doctor.slotDuration * 60 * 1000;
            while (cur + dur <= end) {
                const raw = new Date(cur).toISOString().substr(11, 5); // "09:00"
                const h24 = parseInt(raw.split(":")[0]);
                const min = raw.split(":")[1];
                const ampm = h24 >= 12 ? "PM" : "AM";
                const h12 = ((h24 % 12) || 12).toString().padStart(2, "0");
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// POST /api/doctors/:id/leave  — doctor sets own leave
// ——————————————————————————————————————
router.post("/:id/leave", auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { dates } = req.body; // array of YYYY-MM-DD strings
        const doctorId = req.params.id;
        const doctor = await prisma_1.default.doctorProfile.findUnique({ where: { userId: doctorId } });
        if (!doctor) {
            res.status(404).json({ error: "Doctor not found" });
            return;
        }
        const existing = new Set(doctor.leaveDays);
        dates.forEach(d => existing.add(d));
        await prisma_1.default.doctorProfile.update({
            where: { userId: doctorId },
            data: { leaveDays: Array.from(existing) }
        });
        // Find and cancel affected appointments, queue notifications
        const affected = await prisma_1.default.appointment.findMany({
            where: {
                doctorId,
                appointmentDate: { in: dates },
                status: { in: ["CONFIRMED", "PENDING"] }
            }
        });
        for (const apt of affected) {
            await prisma_1.default.appointment.update({ where: { id: apt.id }, data: { status: "CANCELLED" } });
            await prisma_1.default.notificationQueue.create({
                data: { type: "EMAIL", payload: { appointmentId: apt.id, type: "DOCTOR_LEAVE_CANCELLATION" } }
            });
        }
        res.json({ message: `${dates.length} leave date(s) saved. ${affected.length} appointment(s) cancelled and patients notified.` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
