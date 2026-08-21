import { Router } from "express";
import { addDoctorLeave } from "../controllers/admin.controller";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.post("/leave", authenticate, requireRole(["ADMIN"]), addDoctorLeave);

export default router;
