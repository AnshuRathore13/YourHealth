"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const doctor_controller_1 = require("../controllers/doctor.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post("/post-visit", auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)(["DOCTOR"]), doctor_controller_1.submitPostVisitNotes);
exports.default = router;
