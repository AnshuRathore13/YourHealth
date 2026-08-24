"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
// NOTE: NotificationQueue.status uses enum NotificationStatus { PENDING, FAILED, SENT }
// The updated schema.prisma renames SUCCESS -> SENT. If you haven't migrated yet,
// change "SENT" below to "SUCCESS" to match the original schema.
const router = (0, express_1.Router)();
// ——————————————————————————————————————
// GET /api/admin/stats
// ——————————————————————————————————————
router.get("/stats", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        const [doctors, patients, appointments, cancelled, notifSent] = await Promise.all([
            prisma_1.default.user.count({ where: { role: "DOCTOR" } }),
            prisma_1.default.user.count({ where: { role: "PATIENT" } }),
            prisma_1.default.appointment.count(),
            prisma_1.default.appointment.count({ where: { status: "CANCELLED" } }),
            // Use "SUCCESS" to match original schema enum value
            prisma_1.default.notificationQueue.count({ where: { status: "SUCCESS" } }),
        ]);
        res.json({ doctors, patients, appointments, cancelled, emailsSent: notifSent });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/admin/doctors
// ——————————————————————————————————————
router.get("/doctors", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        const doctors = await prisma_1.default.doctorProfile.findMany({
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { user: { name: "asc" } }
        });
        const shaped = doctors.map(d => ({
            id: d.userId,
            name: d.user?.name || "",
            email: d.user?.email || "",
            specialisation: d.specialization,
            slotDuration: d.slotDuration,
            fee: d.consultationFee || 500,
            experience: d.experience || 5,
            workStart: (d.workingHours?.start) || "09:00",
            workEnd: (d.workingHours?.end) || "17:00",
            bio: d.bio || "",
        }));
        res.json({ data: shaped });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// POST /api/admin/doctors  — create doctor profile + user account
// ——————————————————————————————————————
router.post("/doctors", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        const { name, email, specialisation, phone, slotDuration, fee, experience, workStart, workEnd, bio } = req.body;
        const existing = await prisma_1.default.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: "Email already in use" });
            return;
        }
        const tempPassword = Math.random().toString(36).slice(-10);
        const hashed = await bcryptjs_1.default.hash(tempPassword, 10);
        const user = await prisma_1.default.user.create({
            data: {
                email, name,
                password: hashed,
                role: "DOCTOR",
                doctorProfile: {
                    create: {
                        specialization: specialisation,
                        slotDuration: slotDuration || 30,
                        workingHours: { start: workStart || "09:00", end: workEnd || "17:00" },
                        leaveDays: [],
                    }
                }
            },
            include: { doctorProfile: true }
        });
        // Queue welcome email with temp password
        await prisma_1.default.notificationQueue.create({
            data: { type: "EMAIL", payload: { userId: user.id, type: "DOCTOR_WELCOME", tempPassword } }
        });
        res.status(201).json({ data: user, message: `Doctor created. Credentials sent to ${email}` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// PUT /api/admin/doctors/:id  — update doctor profile
// ——————————————————————————————————————
router.put("/doctors/:id", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        const { name, specialisation, slotDuration, fee, experience, workStart, workEnd, bio } = req.body;
        await prisma_1.default.user.update({
            where: { id: req.params.id },
            data: { name }
        });
        await prisma_1.default.doctorProfile.update({
            where: { userId: req.params.id },
            data: {
                specialization: specialisation,
                slotDuration: slotDuration,
                workingHours: { start: workStart || "09:00", end: workEnd || "17:00" },
            }
        });
        res.json({ message: "Doctor profile updated" });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// DELETE /api/admin/doctors/:id
// ——————————————————————————————————————
router.delete("/doctors/:id", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        // Cancel all future appointments first
        await prisma_1.default.appointment.updateMany({
            where: { doctorId: req.params.id, status: { in: ["CONFIRMED", "PENDING"] } },
            data: { status: "CANCELLED" }
        });
        // Delete doctor profile + user
        await prisma_1.default.doctorProfile.delete({ where: { userId: req.params.id } });
        await prisma_1.default.user.delete({ where: { id: req.params.id } });
        res.json({ message: "Doctor deleted" });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/admin/appointments
// ——————————————————————————————————————
router.get("/appointments", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        const { status, limit = "50", offset = "0" } = req.query;
        const where = {};
        if (status)
            where.status = status.toUpperCase();
        const appointments = await prisma_1.default.appointment.findMany({
            where,
            include: {
                patient: { select: { id: true, name: true, email: true } },
                doctor: { select: { name: true, doctorProfile: true } }
            },
            orderBy: [{ appointmentDate: "desc" }],
            take: parseInt(limit),
            skip: parseInt(offset),
        });
        const shaped = appointments.map(a => ({
            id: a.id,
            patientName: a.patient?.name,
            doctorName: a.doctor?.name,
            appointmentDate: a.appointmentDate,
            timeSlot: a.timeSlot,
            status: a.status.toLowerCase(),
            urgency: a.urgencyLevel || "Low",
            specialisation: a.doctor?.doctorProfile?.specialization,
        }));
        res.json({ data: shaped, total: shaped.length });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/admin/notification-logs
// ——————————————————————————————————————
router.get("/notification-logs", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        const logs = await prisma_1.default.notificationQueue.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        res.json({ data: logs });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/admin/users
// ——————————————————————————————————————
router.get("/users", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["ADMIN"]), async (req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        });
        res.json({ data: users });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
