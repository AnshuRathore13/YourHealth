"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
const sendEmail = async (to, subject, text, html) => {
    if (!process.env.SMTP_USER || process.env.SMTP_USER === "placeholder") {
        console.log(`[Email Mock] To: ${to}, Subject: ${subject}`);
        return { mock: true, messageId: "mock-id" };
    }
    const info = await transporter.sendMail({
        from: '"Healthcare Clinic" <no-reply@healthcare-clinic.com>',
        to,
        subject,
        text,
        html,
    });
    return info;
};
exports.sendEmail = sendEmail;
//# sourceMappingURL=email.service.js.map