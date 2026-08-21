"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addDoctorLeave = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const addDoctorLeave = async (req, res) => {
    try {
        const { doctorId, date } = req.body;
        const doctor = await prisma_1.default.doctorProfile.findUnique({
            where: { userId: doctorId }
        });
        if (!doctor) {
            res.status(404).json({ error: "Doctor not found" });
            return;
        }
        // Add leave date
        const leaveDays = new Set(doctor.leaveDays);
        leaveDays.add(date);
        await prisma_1.default.doctorProfile.update({
            where: { userId: doctorId },
            data: { leaveDays: Array.from(leaveDays) }
        });
        // Find all existing appointments for this doctor on this date
        const affectedAppointments = await prisma_1.default.appointment.findMany({
            where: {
                doctorId,
                appointmentDate: date,
                status: { in: ["CONFIRMED", "PENDING"] }
            }
        });
        // Cancel them and queue notifications
        const notificationData = [];
        for (const app of affectedAppointments) {
            await prisma_1.default.appointment.update({
                where: { id: app.id },
                data: { status: "CANCELLED" }
            });
            notificationData.push({
                type: "EMAIL",
                payload: { appointmentId: app.id, type: "CANCELLATION" }
            });
            if (app.calendarEventId) {
                notificationData.push({
                    type: "CALENDAR",
                    payload: { eventId: app.calendarEventId, type: "CANCEL_EVENT" }
                });
            }
        }
        if (notificationData.length > 0) {
            await prisma_1.default.notificationQueue.createMany({
                data: notificationData
            });
        }
        res.json({ message: "Leave added and appointments cancelled", affectedCount: affectedAppointments.length });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.addDoctorLeave = addDoctorLeave;
//# sourceMappingURL=admin.controller.js.map