"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmBooking = exports.holdSlot = exports.getDoctorAvailability = exports.searchDoctors = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const llm_service_1 = require("../services/llm.service");
const searchDoctors = async (req, res) => {
    try {
        const { specialization } = req.query;
        const whereClause = specialization
            ? { specialization: { contains: String(specialization), mode: "insensitive" } }
            : {};
        const doctors = await prisma_1.default.doctorProfile.findMany({
            where: whereClause,
            include: {
                user: {
                    select: { name: true, email: true }
                }
            }
        });
        res.json(doctors);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.searchDoctors = searchDoctors;
const getDoctorAvailability = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { date } = req.query; // format: YYYY-MM-DD
        if (!date) {
            res.status(400).json({ error: "Date is required" });
            return;
        }
        const doctor = await prisma_1.default.doctorProfile.findUnique({
            where: { userId: doctorId }
        });
        if (!doctor) {
            res.status(404).json({ error: "Doctor not found" });
            return;
        }
        if (doctor.leaveDays.includes(String(date))) {
            res.json({ available: false, reason: "Doctor is on leave", slots: [] });
            return;
        }
        // Get booked or held slots
        const bookedAppointments = await prisma_1.default.appointment.findMany({
            where: {
                doctorId,
                appointmentDate: String(date),
                status: { in: ["PENDING", "CONFIRMED"] }
            }
        });
        // Filter out expired holds
        const now = new Date();
        const activeAppointments = bookedAppointments.filter(app => {
            if (app.status === "PENDING" && app.expiresAt && app.expiresAt < now) {
                return false;
            }
            return true;
        });
        const bookedTimeSlots = activeAppointments.map(a => a.timeSlot);
        // Generate slots based on working hours and slot duration
        const workingHours = doctor.workingHours; // {start: "09:00", end: "17:00"}
        const slots = [];
        if (workingHours && workingHours.start && workingHours.end) {
            let current = new Date(`1970-01-01T${workingHours.start}:00Z`).getTime();
            const end = new Date(`1970-01-01T${workingHours.end}:00Z`).getTime();
            const durationMs = doctor.slotDuration * 60 * 1000;
            while (current + durationMs <= end) {
                const timeString = new Date(current).toISOString().substr(11, 5);
                if (!bookedTimeSlots.includes(timeString)) {
                    slots.push(timeString);
                }
                current += durationMs;
            }
        }
        res.json({ available: true, slots });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getDoctorAvailability = getDoctorAvailability;
const holdSlot = async (req, res) => {
    try {
        const { doctorId, date, timeSlot } = req.body;
        const patientId = req.user.id;
        // Create a 5-minute hold. Atomic insert due to DB unique constraint
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        try {
            const appointment = await prisma_1.default.appointment.create({
                data: {
                    patientId,
                    doctorId,
                    appointmentDate: date,
                    timeSlot,
                    status: "PENDING",
                    expiresAt
                }
            });
            res.json(appointment);
        }
        catch (e) {
            if (e.code === 'P2002') {
                // Unique constraint violation (double booking)
                res.status(409).json({ error: "Slot is no longer available" });
                return;
            }
            throw e;
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.holdSlot = holdSlot;
const confirmBooking = async (req, res) => {
    try {
        const { appointmentId, symptoms } = req.body;
        const patientId = req.user.id;
        const appointment = await prisma_1.default.appointment.findUnique({
            where: { id: appointmentId }
        });
        if (!appointment || appointment.patientId !== patientId) {
            res.status(404).json({ error: "Appointment not found" });
            return;
        }
        if (appointment.status !== "PENDING") {
            res.status(400).json({ error: "Appointment cannot be confirmed" });
            return;
        }
        if (appointment.expiresAt && appointment.expiresAt < new Date()) {
            res.status(400).json({ error: "Slot hold expired" });
            return;
        }
        // Generate AI Summary
        const aiSummary = await (0, llm_service_1.generatePreVisitSummary)(symptoms);
        const updatedAppointment = await prisma_1.default.appointment.update({
            where: { id: appointmentId },
            data: {
                status: "CONFIRMED",
                symptoms,
                preVisitSummary: aiSummary.preVisitSummary,
                urgencyLevel: aiSummary.urgencyLevel,
                expiresAt: null // Clear the hold
            }
        });
        // Queue notifications (Email, Calendar)
        await prisma_1.default.notificationQueue.createMany({
            data: [
                { type: "EMAIL", payload: { appointmentId, type: "BOOKING_CONFIRMATION" } },
                { type: "CALENDAR", payload: { appointmentId, type: "CREATE_EVENT" } }
            ]
        });
        res.json(updatedAppointment);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.confirmBooking = confirmBooking;
//# sourceMappingURL=booking.controller.js.map