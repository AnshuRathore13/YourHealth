"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key_for_placement";
// ——————————————————————————————————————
// GET /api/appointments  — patient: own appointments; doctor: their schedule; admin: all
// ——————————————————————————————————————
router.get("/", auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { status, date, limit = "50", offset = "0" } = req.query;
        const user = req.user;
        let where = {};
        if (user.role === "PATIENT") {
            where.patientId = user.id;
        }
        else if (user.role === "DOCTOR") {
            where.doctorId = user.id;
        }
        // ADMIN sees all
        if (status)
            where.status = status.toUpperCase();
        if (date)
            where.appointmentDate = date;
        const appointments = await prisma_1.default.appointment.findMany({
            where,
            include: {
                patient: { select: { id: true, name: true, email: true } },
                doctor: { select: { id: true, name: true, email: true } }
            },
            orderBy: [{ appointmentDate: "asc" }, { timeSlot: "asc" }],
            take: parseInt(limit),
            skip: parseInt(offset),
        });
        res.json({ data: appointments, total: appointments.length });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/appointments/:id
// ——————————————————————————————————————
router.get("/:id", auth_middleware_1.authenticate, async (req, res) => {
    try {
        const apt = await prisma_1.default.appointment.findUnique({
            where: { id: req.params.id },
            include: {
                patient: { select: { id: true, name: true, email: true } },
                doctor: { select: { id: true, name: true, email: true } }
            }
        });
        if (!apt) {
            res.status(404).json({ error: "Appointment not found" });
            return;
        }
        res.json(apt);
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// POST /api/appointments  — combined hold + confirm with AI (frontend unified endpoint)
// ——————————————————————————————————————
router.post("/", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["PATIENT"]), async (req, res) => {
    try {
        const { doctorId, date, time, symptoms, preVisitSummary, urgency } = req.body;
        const patientId = req.user.id;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        try {
            // 1. Check if patient already has a non-cancelled appointment at this date/time
            const patientConflict = await prisma_1.default.appointment.findFirst({
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
            const doctorConflict = await prisma_1.default.appointment.findFirst({
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
            const appointment = await prisma_1.default.appointment.create({
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
            await prisma_1.default.notificationQueue.createMany({
                data: [
                    { type: "EMAIL", payload: { appointmentId: appointment.id, type: "BOOKING_CONFIRMATION" } },
                    { type: "CALENDAR", payload: { appointmentId: appointment.id, type: "CREATE_EVENT" } },
                ]
            });
            res.status(201).json({ data: appointment, message: "Appointment booked successfully" });
        }
        catch (e) {
            if (e.code === "P2002") {
                res.status(409).json({ error: "Slot is no longer available — double-booking prevented" });
                return;
            }
            console.error(e);
            res.status(500).json({ error: "Internal server error during booking" });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// PATCH /api/appointments/:id/cancel
// ——————————————————————————————————————
router.patch("/:id/cancel", auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { reason } = req.body;
        const apt = await prisma_1.default.appointment.update({
            where: { id: req.params.id },
            data: { status: "CANCELLED" }
        });
        await prisma_1.default.notificationQueue.create({
            data: { type: "EMAIL", payload: { appointmentId: apt.id, type: "CANCELLATION", reason } }
        });
        if (apt.calendarEventId) {
            await prisma_1.default.notificationQueue.create({
                data: { type: "CALENDAR", payload: { eventId: apt.calendarEventId, type: "CANCEL_EVENT" } }
            });
        }
        res.json({ data: apt, message: "Appointment cancelled" });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// PATCH /api/appointments/:id/complete  — doctor submits notes inline
// ——————————————————————————————————————
router.patch("/:id/complete", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["DOCTOR"]), async (req, res) => {
    try {
        const { notes, prescription } = req.body;
        // Import LLM service dynamically to avoid circular imports
        const { generatePostVisitSummary } = await Promise.resolve().then(() => __importStar(require("../services/llm.service")));
        const patientSummary = await generatePostVisitSummary(notes + (prescription ? `. Prescription: ${prescription}` : ""));
        const apt = await prisma_1.default.appointment.update({
            where: { id: req.params.id },
            data: {
                status: "COMPLETED",
                postVisitNotes: notes,
                postVisitSummary: patientSummary,
            }
        });
        await prisma_1.default.notificationQueue.create({
            data: { type: "EMAIL", payload: { appointmentId: apt.id, type: "POST_VISIT_SUMMARY" } }
        });
        res.json({ data: apt, patientSummary, message: "Notes submitted and AI summary generated" });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// PATCH /api/appointments/:id/reschedule
// ——————————————————————————————————————
router.patch("/:id/reschedule", auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { date, time } = req.body;
        const apt = await prisma_1.default.appointment.update({
            where: { id: req.params.id },
            data: { appointmentDate: date, timeSlot: time, status: "CONFIRMED" }
        });
        await prisma_1.default.notificationQueue.createMany({
            data: [
                { type: "EMAIL", payload: { appointmentId: apt.id, type: "RESCHEDULE" } },
                { type: "CALENDAR", payload: { appointmentId: apt.id, type: "UPDATE_EVENT" } },
            ]
        });
        res.json({ data: apt, message: "Appointment rescheduled" });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
