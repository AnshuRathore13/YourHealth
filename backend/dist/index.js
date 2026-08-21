"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const doctor_routes_1 = __importDefault(require("./routes/doctor.routes"));
const notification_worker_1 = require("./workers/notification.worker");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Basic healthcheck
app.get("/api/health", (req, res) => {
    res.json({ status: "OK", timestamp: new Date() });
});
// Routes
app.use("/api/auth", auth_routes_1.default);
app.use("/api/booking", booking_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
app.use("/api/doctor", doctor_routes_1.default);
// Start background workers
(0, notification_worker_1.startWorkers)();
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
