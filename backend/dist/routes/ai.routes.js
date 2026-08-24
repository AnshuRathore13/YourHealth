"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const llm_service_1 = require("../services/llm.service");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// POST /api/ai/pre-visit
router.post("/pre-visit", auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { symptoms, appointmentId } = req.body;
        if (!symptoms || typeof symptoms !== "string") {
            res.status(400).json({ error: "symptoms (string) is required" });
            return;
        }
        const result = await (0, llm_service_1.generatePreVisitSummary)(symptoms);
        res.json({
            urgency: result.urgencyLevel,
            summary: result.preVisitSummary,
            appointmentId: appointmentId || null,
        });
    }
    catch (error) {
        console.error("AI pre-visit error:", error);
        res.status(500).json({ error: "Failed to generate AI summary" });
    }
});
// POST /api/ai/post-visit
router.post("/post-visit", auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { notes, appointmentId } = req.body;
        if (!notes || typeof notes !== "string") {
            res.status(400).json({ error: "notes (string) is required" });
            return;
        }
        const summary = await (0, llm_service_1.generatePostVisitSummary)(notes);
        res.json({
            patientSummary: summary,
            appointmentId: appointmentId || null,
        });
    }
    catch (error) {
        console.error("AI post-visit error:", error);
        res.status(500).json({ error: "Failed to generate AI post-visit summary" });
    }
});
exports.default = router;
