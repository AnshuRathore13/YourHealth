"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const booking_controller_1 = require("../controllers/booking.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get("/doctors", booking_controller_1.searchDoctors);
router.get("/doctors/:doctorId/availability", booking_controller_1.getDoctorAvailability);
router.post("/hold", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["PATIENT"]), booking_controller_1.holdSlot);
router.post("/confirm", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["PATIENT"]), booking_controller_1.confirmBooking);
exports.default = router;
//# sourceMappingURL=booking.routes.js.map