import { Request, Response } from "express";
import prisma from "../prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { generatePreVisitSummary } from "../services/llm.service";

export const searchDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const specialization = req.query.specialization as string;
    
    const whereClause = specialization 
      ? { specialization: { contains: specialization as string, mode: "insensitive" as any } }
      : {};
      
    const doctors = await prisma.doctorProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });
    
    res.json(doctors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getDoctorAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.params.doctorId as string;
    const date = req.query.date as string; // format: YYYY-MM-DD
    
    if (!date) {
      res.status(400).json({ error: "Date is required" });
      return;
    }
    
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: doctorId }
    });
    
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }
    
    if (doctor.leaveDays.includes(date as string)) {
      res.json({ available: false, reason: "Doctor is on leave", slots: [] });
      return;
    }
    
    // Get booked or held slots
    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: date as string,
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
    const workingHours = doctor.workingHours as any; // {start: "09:00", end: "17:00"}
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const holdSlot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { doctorId, date, timeSlot } = req.body;
    const patientId = req.user!.id;
    
    // Create a 5-minute hold. Atomic insert due to DB unique constraint
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    try {
      const appointment = await prisma.appointment.create({
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
    } catch (e: any) {
      if (e.code === 'P2002') {
        // Unique constraint violation (double booking)
        res.status(409).json({ error: "Slot is no longer available" });
        return;
      }
      throw e;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const confirmBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { appointmentId, symptoms } = req.body;
    const patientId = req.user!.id;
    
    const appointment = await prisma.appointment.findUnique({
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
    const aiSummary = await generatePreVisitSummary(symptoms);
    
    const updatedAppointment = await prisma.appointment.update({
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
    await prisma.notificationQueue.createMany({
      data: [
        { type: "EMAIL", payload: { appointmentId, type: "BOOKING_CONFIRMATION" } },
        { type: "CALENDAR", payload: { appointmentId, type: "CREATE_EVENT" } }
      ]
    });
    
    res.json(updatedAppointment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
