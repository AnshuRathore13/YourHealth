import cron from "node-cron";
import prisma from "../prisma";
import { sendEmail } from "../services/email.service";
import { createCalendarEvent, cancelCalendarEvent } from "../services/calendar.service";

export const startWorkers = () => {
  // Run every minute
  cron.schedule("* * * * *", async () => {
    try {
      const pendingJobs = await prisma.notificationQueue.findMany({
        where: {
          status: "PENDING",
          retryCount: { lt: 5 } // max 5 retries
        },
        take: 20 // process in batches
      });
      
      for (const job of pendingJobs) {
        try {
          const payload = job.payload as any;
          
          if (job.type === "EMAIL") {
            if (payload.type === "DOCTOR_WELCOME") {
              const user = await prisma.user.findUnique({ where: { id: payload.userId } });
              if (user) {
                await sendEmail(
                  user.email,
                  "Welcome to YourHealth",
                  `Hi Dr. ${user.name},\n\nYour account has been created.\nEmail: ${user.email}\nTemporary Password: ${payload.tempPassword}`
                );
              }
            } else if (payload.type === "PASSWORD_RESET") {
              const resetLink = `http://localhost:3000/auth/login.html?reset_token=${payload.token}`;
              await sendEmail(
                payload.email,
                "Password Reset Request - YourHealth",
                `Hi ${payload.name},\n\nYou requested a password reset. Please click the link below to set a new password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email.\nThis link will expire in 1 hour.`
              );
            } else {
              const appointment = await prisma.appointment.findUnique({
                where: { id: payload.appointmentId },
                include: { patient: true, doctor: true }
              });
              
              if (appointment) {
                let subject = "";
                let text = "";
                
                if (payload.type === "BOOKING_CONFIRMATION") {
                  subject = "Appointment Confirmed";
                  text = `Hi ${appointment.patient.name}, your appointment with ${appointment.doctor.name} on ${appointment.appointmentDate} at ${appointment.timeSlot} is confirmed.`;
                } else if (payload.type === "CANCELLATION") {
                  subject = "Appointment Cancelled";
                  text = `Hi ${appointment.patient.name}, unfortunately your appointment on ${appointment.appointmentDate} has been cancelled.`;
                } else if (payload.type === "POST_VISIT_SUMMARY") {
                  subject = "Your Visit Summary";
                  text = `Hi ${appointment.patient.name}, here is your post-visit summary:\n\n${appointment.postVisitSummary}`;
                }
                
                if (subject) {
                  await sendEmail(appointment.patient.email, subject, text);
                }
              }
            }
          } else if (job.type === "CALENDAR") {
             if (payload.type === "CREATE_EVENT") {
               const appointment = await prisma.appointment.findUnique({
                 where: { id: payload.appointmentId },
                 include: { patient: true, doctor: true }
               });
               
               if (appointment) {
                 const [hour, min] = appointment.timeSlot.split(":");
                 const startDateTime = new Date(appointment.appointmentDate);
                 startDateTime.setHours(Number(hour), Number(min));
                 
                 // Default duration 30 mins if we don't fetch doctor profile here
                 const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);
                 
                 const eventId = await createCalendarEvent({
                   summary: `Appointment: ${appointment.patient.name} & ${appointment.doctor.name}`,
                   description: "Healthcare appointment",
                   startDateTime: startDateTime.toISOString(),
                   endDateTime: endDateTime.toISOString()
                 });
                 
                 await prisma.appointment.update({
                   where: { id: appointment.id },
                   data: { calendarEventId: eventId || null }
                 });
               }
             } else if (payload.type === "CANCEL_EVENT" && payload.eventId) {
               await cancelCalendarEvent(payload.eventId);
             }
          }
          
          await prisma.notificationQueue.update({
            where: { id: job.id },
            data: { status: "SUCCESS" }
          });
        } catch (error: any) {
          console.error(`Job ${job.id} failed:`, error);
          await prisma.notificationQueue.update({
            where: { id: job.id },
            data: {
              retryCount: job.retryCount + 1,
              errorMessage: error.message || "Unknown error",
              status: job.retryCount + 1 >= 5 ? "FAILED" : "PENDING"
            }
          });
        }
      }
    } catch (error) {
      console.error("Worker error:", error);
    }
  });
  
  console.log("Background workers started.");
};
