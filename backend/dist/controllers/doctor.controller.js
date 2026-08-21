"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitPostVisitNotes = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const llm_service_1 = require("../services/llm.service");
const submitPostVisitNotes = async (req, res) => {
    try {
        const { appointmentId, notes, prescriptionFrequencyDays } = req.body;
        const doctorId = req.user.id;
        const appointment = await prisma_1.default.appointment.findUnique({
            where: { id: appointmentId }
        });
        if (!appointment || appointment.doctorId !== doctorId) {
            res.status(404).json({ error: "Appointment not found" });
            return;
        }
        const summary = await (0, llm_service_1.generatePostVisitSummary)(notes);
        await prisma_1.default.appointment.update({
            where: { id: appointmentId },
            data: {
                status: "COMPLETED",
                postVisitNotes: notes,
                postVisitSummary: summary,
            }
        });
        const notifications = [
            { type: "EMAIL", payload: { appointmentId, type: "POST_VISIT_SUMMARY" } }
        ];
        // Simple medication reminder scheduling: assume one reminder per day for `prescriptionFrequencyDays`
        if (prescriptionFrequencyDays && typeof prescriptionFrequencyDays === "number") {
            // In a real app we'd schedule it based on exact hours, here we queue a generic daily reminder
            notifications.push({
                type: "EMAIL",
                payload: { appointmentId, type: "MEDICATION_REMINDER" }
            });
        }
        await prisma_1.default.notificationQueue.createMany({
            data: notifications
        });
        res.json({ message: "Notes submitted and summary generated successfully", summary });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.submitPostVisitNotes = submitPostVisitNotes;
