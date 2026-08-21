import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
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
