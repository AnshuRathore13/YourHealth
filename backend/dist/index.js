"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// ——— Original routes ———
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const doctor_routes_1 = __importDefault(require("./routes/doctor.routes"));
// ——— Extended / new routes ———
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const appointments_routes_1 = __importDefault(require("./routes/appointments.routes"));
const doctors_routes_1 = __importDefault(require("./routes/doctors.routes"));
const admin_extended_routes_1 = __importDefault(require("./routes/admin-extended.routes"));
const patient_routes_1 = __importDefault(require("./routes/patient.routes"));
const doctor_extended_routes_1 = __importDefault(require("./routes/doctor-extended.routes"));
const notification_worker_1 = require("./workers/notification.worker");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// ——————————————————————————————
// CORS — allow frontend (local file and dev server)
// ——————————————————————————————
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5500", // VS Code Live Server
        "http://localhost:8080",
        "null", // file:// origin in some browsers
        /^https:\/\/yourhealth.*\.vercel\.app$/,
    ],
    credentials: true,
}));
app.use(express_1.default.json());
// ——————————————————————————————
// Health check
// ——————————————————————————————
app.get("/api/health", (_req, res) => {
    res.json({ status: "OK", version: "2.0", timestamp: new Date() });
});
// ——————————————————————————————
// Auth
// ——————————————————————————————
app.use("/api/auth", auth_routes_1.default);
// ——————————————————————————————
// AI (Gemini)
// ——————————————————————————————
app.use("/api/ai", ai_routes_1.default);
// ——————————————————————————————
// Doctors (public listing + availability)
// ——————————————————————————————
app.use("/api/doctors", doctors_routes_1.default);
// ——————————————————————————————
// Appointments (unified)
// ——————————————————————————————
app.use("/api/appointments", appointments_routes_1.default);
// ——————————————————————————————
// Patient portal
// ——————————————————————————————
app.use("/api/patient", patient_routes_1.default);
// ——————————————————————————————
// Doctor portal (extended)
// ——————————————————————————————
app.use("/api/doctor", doctor_extended_routes_1.default);
app.use("/api/doctor", doctor_routes_1.default); // original post-visit notes route
// ——————————————————————————————
// Booking flow (hold + confirm, legacy)
// ——————————————————————————————
app.use("/api/booking", booking_routes_1.default);
// ——————————————————————————————
// Admin (extended first, then original leave-only)
// ——————————————————————————————
app.use("/api/admin", admin_extended_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
// ——————————————————————————————
// 404 catch-all
// ——————————————————————————————
app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});
// ——————————————————————————————
// Start background workers
// ——————————————————————————————
(0, notification_worker_1.startWorkers)();
app.listen(PORT, () => {
    console.log(`\n🚀 YourHealth API running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Env:    ${process.env.NODE_ENV || "development"}\n`);
});
