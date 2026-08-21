import { Request, Response } from "express";
import prisma from "../prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import { generatePostVisitSummary } from "../services/llm.service";

export const submitPostVisitNotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { appointmentId, notes, prescriptionFrequencyDays } = req.body;
    const doctorId = req.user!.id;
    
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId }
    });
    
    if (!appointment || appointment.doctorId !== doctorId) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }
    
    const summary = await generatePostVisitSummary(notes);
    
    await prisma.appointment.update({
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
    
    await prisma.notificationQueue.createMany({
      data: notifications
    });
    
    res.json({ message: "Notes submitted and summary generated successfully", summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
