import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// ——— Original routes ———
import authRoutes    from "./routes/auth.routes";
import bookingRoutes from "./routes/booking.routes";
import adminRoutes   from "./routes/admin.routes";
import doctorRoutes  from "./routes/doctor.routes";

// ——— Extended / new routes ———
import aiRoutes          from "./routes/ai.routes";
import appointmentRoutes from "./routes/appointments.routes";
import doctorsRoutes     from "./routes/doctors.routes";
import adminExtRoutes    from "./routes/admin-extended.routes";
import patientRoutes     from "./routes/patient.routes";
import doctorExtRoutes   from "./routes/doctor-extended.routes";

import { startWorkers } from "./workers/notification.worker";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ——————————————————————————————
// CORS — allow frontend (local file and dev server)
// ——————————————————————————————
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5500",   // VS Code Live Server
    "http://localhost:8080",
    "null",                    // file:// origin in some browsers
    /^https:\/\/yourhealth.*\.vercel\.app$/,
  ],
  credentials: true,
}));

app.use(express.json());

// ——————————————————————————————
// Health check
// ——————————————————————————————
app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", version: "2.0", timestamp: new Date() });
});

// ——————————————————————————————
// Auth
// ——————————————————————————————
app.use("/api/auth",    authRoutes);

// ——————————————————————————————
// AI (Gemini)
// ——————————————————————————————
app.use("/api/ai",      aiRoutes);

// ——————————————————————————————
// Doctors (public listing + availability)
// ——————————————————————————————
app.use("/api/doctors", doctorsRoutes);

// ——————————————————————————————
// Appointments (unified)
// ——————————————————————————————
app.use("/api/appointments", appointmentRoutes);

// ——————————————————————————————
// Patient portal
// ——————————————————————————————
app.use("/api/patient", patientRoutes);

// ——————————————————————————————
// Doctor portal (extended)
// ——————————————————————————————
app.use("/api/doctor",  doctorExtRoutes);
app.use("/api/doctor",  doctorRoutes);      // original post-visit notes route

// ——————————————————————————————
// Booking flow (hold + confirm, legacy)
// ——————————————————————————————
app.use("/api/booking",  bookingRoutes);

// ——————————————————————————————
// Admin (extended first, then original leave-only)
// ——————————————————————————————
app.use("/api/admin", adminExtRoutes);
app.use("/api/admin", adminRoutes);

// ——————————————————————————————
// 404 catch-all
// ——————————————————————————————
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ——————————————————————————————
// Start background workers
// ——————————————————————————————
startWorkers();

app.listen(PORT, () => {
  console.log(`\n🚀 YourHealth API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Env:    ${process.env.NODE_ENV || "development"}\n`);
});
