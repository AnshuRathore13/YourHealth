import { Router } from "express";
import { searchDoctors, getDoctorAvailability, holdSlot, confirmBooking } from "../controllers/booking.controller";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get("/doctors", searchDoctors);
router.get("/doctors/:doctorId/availability", getDoctorAvailability);

router.post("/hold", authenticate, requireRole(["PATIENT"]), holdSlot);
router.post("/confirm", authenticate, requireRole(["PATIENT"]), confirmBooking);

export default router;
