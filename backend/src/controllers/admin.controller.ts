import { Request, Response } from "express";
import prisma from "../prisma";
import { AuthRequest } from "../middlewares/auth.middleware";

export const addDoctorLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, date } = req.body;
    
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: doctorId }
    });
    
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }
    
    // Add leave date
    const leaveDays = new Set(doctor.leaveDays);
    leaveDays.add(date);
    
    await prisma.doctorProfile.update({
      where: { userId: doctorId },
      data: { leaveDays: Array.from(leaveDays) }
    });
    
    // Find all existing appointments for this doctor on this date
    const affectedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: date,
        status: { in: ["CONFIRMED", "PENDING"] }
      }
    });
    
    // Cancel them and queue notifications
    const notificationData = [];
    for (const app of affectedAppointments) {
      await prisma.appointment.update({
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
      await prisma.notificationQueue.createMany({
        data: notificationData
      });
    }
    
    res.json({ message: "Leave added and appointments cancelled", affectedCount: affectedAppointments.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
