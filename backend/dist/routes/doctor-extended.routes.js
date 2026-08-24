"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const llm_service_1 = require("../services/llm.service");
const router = (0, express_1.Router)();
// ——————————————————————————————————————
// GET /api/doctor/schedule?date=YYYY-MM-DD
// ——————————————————————————————————————
router.get("/schedule", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["DOCTOR"]), async (req, res) => {
    try {
        const { date } = req.query;
        const where = { doctorId: req.user.id };
        if (date)
            where.appointmentDate = date;
        const apts = await prisma_1.default.appointment.findMany({
            where,
            include: { patient: { select: { id: true, name: true, email: true } } },
            orderBy: { timeSlot: "asc" }
        });
        const shaped = apts.map(a => ({
            id: a.id,
            appointmentDate: a.appointmentDate,
            timeSlot: a.timeSlot,
            patientName: a.patient?.name || "",
            patientEmail: a.patient?.email || "",
            status: a.status.toLowerCase(),
            urgency: a.urgencyLevel || "Low",
            preVisitSummary: a.preVisitSummary || "",
            postVisitSummary: a.postVisitSummary || null,
            symptoms: a.symptoms || "",
        }));
        res.json({ data: shaped });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/doctor/profile
// ——————————————————————————————————————
router.get("/profile", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["DOCTOR"]), async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            include: { doctorProfile: true }
        });
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// PATCH /api/doctor/profile
// ——————————————————————————————————————
router.patch("/profile", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["DOCTOR"]), async (req, res) => {
    try {
        const { workingHours, slotDuration } = req.body;
        // Find the doctor's profile ID first
        const docProfile = await prisma_1.default.doctorProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!docProfile) {
            res.status(404).json({ error: "Doctor profile not found" });
            return;
        }
        const updated = await prisma_1.default.doctorProfile.update({
            where: { id: docProfile.id },
            data: {
                workingHours: workingHours || docProfile.workingHours,
                slotDuration: slotDuration || docProfile.slotDuration,
            }
        });
        res.json({ message: "Profile updated successfully", data: updated });
    }
    catch (error) {
        console.error("PATCH /doctor/profile error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/doctor/patients  — list unique patients seen
// ——————————————————————————————————————
router.get("/patients", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["DOCTOR"]), async (req, res) => {
    try {
        const apts = await prisma_1.default.appointment.findMany({
            where: { doctorId: req.user.id, status: "COMPLETED" },
            include: { patient: { select: { id: true, name: true, email: true } } },
            distinct: ["patientId"],
        });
        res.json({ data: apts.map(a => a.patient) });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// POST /api/doctor/appointments/:id/notes  — submit post-visit notes
// ——————————————————————————————————————
router.post("/appointments/:id/notes", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["DOCTOR"]), async (req, res) => {
    try {
        const { notes, prescription, prescriptionFrequencyDays } = req.body;
        const doctorId = req.user.id;
        const appointmentId = req.params.id;
        const apt = await prisma_1.default.appointment.findUnique({ where: { id: appointmentId } });
        if (!apt || apt.doctorId !== doctorId) {
            res.status(404).json({ error: "Appointment not found" });
            return;
        }
        const fullNotes = notes + (prescription ? `\n\nPrescription: ${prescription}` : "");
        const patientSummary = await (0, llm_service_1.generatePostVisitSummary)(fullNotes);
        const updated = await prisma_1.default.appointment.update({
            where: { id: appointmentId },
            data: {
                status: "COMPLETED",
                postVisitNotes: fullNotes,
                postVisitSummary: patientSummary,
            }
        });
        const notifications = [
            { type: "EMAIL", payload: { appointmentId, type: "POST_VISIT_SUMMARY" } }
        ];
        try {
            const parsedSummary = JSON.parse(patientSummary);
            if (parsedSummary.medication && parsedSummary.medication.durationDays) {
                notifications.push({
                    type: "EMAIL",
                    payload: {
                        appointmentId,
                        type: "MEDICATION_REMINDER",
                        days: parsedSummary.medication.durationDays
                    }
                });
            }
        }
        catch (e) {
            // Ignore parse errors, just means no reminder
        }
        await prisma_1.default.notificationQueue.createMany({ data: notifications });
        res.json({ data: updated, patientSummary, message: "Notes submitted. AI summary generated and sent to patient." });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ——————————————————————————————————————
// GET /api/doctor/prescriptions
// ——————————————————————————————————————
router.get("/prescriptions", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["DOCTOR"]), async (req, res) => {
    try {
        const apts = await prisma_1.default.appointment.findMany({
            where: { doctorId: req.user.id, status: "COMPLETED" },
            select: { id: true, postVisitNotes: true, appointmentDate: true, patient: { select: { name: true } } },
            orderBy: { appointmentDate: "desc" }
        });
        const prescriptions = apts
            .filter(a => a.postVisitNotes)
            .map(a => ({
            id: a.id,
            patientName: a.patient.name,
            name: extractMedName(a.postVisitNotes || ""),
            dosage: extractDosage(a.postVisitNotes || ""),
            frequency: extractFrequency(a.postVisitNotes || ""),
            date: a.appointmentDate,
        }));
        res.json({ data: prescriptions });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
function extractMedName(notes) {
    const match = notes.match(/(?:prescription|prescribed|take|medication)[\s:]+([a-z\s\-]+ \d+mg)/i);
    return match ? match[1] : "Prescribed medication";
}
function extractDosage(notes) {
    const match = notes.match(/(\d+mg)/i);
    return match ? match[1] : "As prescribed";
}
function extractFrequency(notes) {
    if (/twice daily/i.test(notes))
        return "Twice daily";
    if (/once daily/i.test(notes))
        return "Once daily";
    if (/thrice daily/i.test(notes))
        return "Three times daily";
    if (/bedtime/i.test(notes))
        return "Bedtime";
    return "Daily";
}
exports.default = router;
