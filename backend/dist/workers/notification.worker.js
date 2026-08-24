"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkers = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../prisma"));
const email_service_1 = require("../services/email.service");
const calendar_service_1 = require("../services/calendar.service");
const startWorkers = () => {
    // Run every minute
    node_cron_1.default.schedule("* * * * *", async () => {
        try {
            const pendingJobs = await prisma_1.default.notificationQueue.findMany({
                where: {
                    status: "PENDING",
                    retryCount: { lt: 5 } // max 5 retries
                },
                take: 20 // process in batches
            });
            for (const job of pendingJobs) {
                try {
                    const payload = job.payload;
                    if (job.type === "EMAIL") {
                        if (payload.type === "DOCTOR_WELCOME") {
                            const user = await prisma_1.default.user.findUnique({ where: { id: payload.userId } });
                            if (user) {
                                await (0, email_service_1.sendEmail)(user.email, "Welcome to YourHealth", `Hi Dr. ${user.name},\n\nYour account has been created.\nEmail: ${user.email}\nTemporary Password: ${payload.tempPassword}`);
                            }
                        }
                        else if (payload.type === "PASSWORD_RESET") {
                            const resetLink = `http://localhost:3000/auth/login.html?reset_token=${payload.token}`;
                            await (0, email_service_1.sendEmail)(payload.email, "Password Reset Request - YourHealth", `Hi ${payload.name},\n\nYou requested a password reset. Please click the link below to set a new password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.\nThis link will expire in 1 hour.`);
                        }
                        else {
                            const appointment = await prisma_1.default.appointment.findUnique({
                                where: { id: payload.appointmentId },
                                include: { patient: true, doctor: true }
                            });
                            if (appointment) {
                                let subject = "";
                                let text = "";
                                if (payload.type === "BOOKING_CONFIRMATION") {
                                    subject = "Appointment Confirmed";
                                    text = `Hi ${appointment.patient.name}, your appointment with ${appointment.doctor.name} on ${appointment.appointmentDate} at ${appointment.timeSlot} is confirmed.`;
                                }
                                else if (payload.type === "CANCELLATION") {
                                    subject = "Appointment Cancelled";
                                    text = `Hi ${appointment.patient.name}, unfortunately your appointment on ${appointment.appointmentDate} has been cancelled.`;
                                }
                                else if (payload.type === "POST_VISIT_SUMMARY") {
                                    subject = "Your Visit Summary";
                                    text = `Hi ${appointment.patient.name}, here is your post-visit summary:\n\n${appointment.postVisitSummary}`;
                                }
                                if (subject) {
                                    await (0, email_service_1.sendEmail)(appointment.patient.email, subject, text);
                                }
                            }
                        }
                    }
                    else if (job.type === "CALENDAR") {
                        if (payload.type === "CREATE_EVENT") {
                            const appointment = await prisma_1.default.appointment.findUnique({
                                where: { id: payload.appointmentId },
                                include: { patient: true, doctor: true }
                            });
                            if (appointment) {
                                const [hour, min] = appointment.timeSlot.split(":");
                                const startDateTime = new Date(appointment.appointmentDate);
                                startDateTime.setHours(Number(hour), Number(min));
                                // Default duration 30 mins if we don't fetch doctor profile here
                                const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);
                                const eventId = await (0, calendar_service_1.createCalendarEvent)({
                                    summary: `Appointment: ${appointment.patient.name} & ${appointment.doctor.name}`,
                                    description: "Healthcare appointment",
                                    startDateTime: startDateTime.toISOString(),
                                    endDateTime: endDateTime.toISOString()
                                });
                                await prisma_1.default.appointment.update({
                                    where: { id: appointment.id },
                                    data: { calendarEventId: eventId || null }
                                });
                            }
                        }
                        else if (payload.type === "CANCEL_EVENT" && payload.eventId) {
                            await (0, calendar_service_1.cancelCalendarEvent)(payload.eventId);
                        }
                    }
                    await prisma_1.default.notificationQueue.update({
                        where: { id: job.id },
                        data: { status: "SUCCESS" }
                    });
                }
                catch (error) {
                    console.error(`Job ${job.id} failed:`, error);
                    await prisma_1.default.notificationQueue.update({
                        where: { id: job.id },
                        data: {
                            retryCount: job.retryCount + 1,
                            errorMessage: error.message || "Unknown error",
                            status: job.retryCount + 1 >= 5 ? "FAILED" : "PENDING"
                        }
                    });
                }
            }
        }
        catch (error) {
            console.error("Worker error:", error);
        }
    });
    console.log("Background workers started.");
};
exports.startWorkers = startWorkers;
