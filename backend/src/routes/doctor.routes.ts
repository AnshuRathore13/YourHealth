import { Router } from "express";
import { submitPostVisitNotes } from "../controllers/doctor.controller";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.post("/post-visit", authenticate, requireRole(["DOCTOR"]), submitPostVisitNotes);

export default router;
