import { Router } from "express";
import { generatePreVisitSummary, generatePostVisitSummary } from "../services/llm.service";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// POST /api/ai/pre-visit
router.post("/pre-visit", authenticate, async (req, res): Promise<void> => {
  try {
    const { symptoms, appointmentId } = req.body;
    if (!symptoms || typeof symptoms !== "string") {
      res.status(400).json({ error: "symptoms (string) is required" });
      return;
    }
    const result = await generatePreVisitSummary(symptoms);
    res.json({
      urgency:  result.urgencyLevel,
      summary:  result.preVisitSummary,
      appointmentId: appointmentId || null,
    });
  } catch (error) {
    console.error("AI pre-visit error:", error);
    res.status(500).json({ error: "Failed to generate AI summary" });
  }
});

// POST /api/ai/post-visit
router.post("/post-visit", authenticate, async (req, res): Promise<void> => {
  try {
    const { notes, appointmentId } = req.body;
    if (!notes || typeof notes !== "string") {
      res.status(400).json({ error: "notes (string) is required" });
      return;
    }
    const summary = await generatePostVisitSummary(notes);
    res.json({
      patientSummary: summary,
      appointmentId:  appointmentId || null,
    });
  } catch (error) {
    console.error("AI post-visit error:", error);
    res.status(500).json({ error: "Failed to generate AI post-visit summary" });
  }
});

export default router;
