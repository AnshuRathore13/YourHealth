# Healthcare Appointment & Follow-up Manager (YourHealth)

A comprehensive healthcare appointment platform with dedicated portals for Patients, Doctors, and Administrators. Features AI-powered symptom analysis, clinical note translation, automated Google Calendar syncing, robust concurrency control, and asynchronous email notifications.

---

## 🚀 Setup Guide

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- Google Gemini API Key
- Google Cloud Console Project (for Calendar API OAuth 2.0)
- SMTP credentials (for Nodemailer)

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Environment Configuration:
   - Copy `.env.example` to `.env` in the root of the backend folder.
   - Fill in your database URL, Gemini API key, Google OAuth credentials, and SMTP details.
4. Database Initialization (Prisma):
   ```bash
   npx prisma db push
   npx prisma generate
   ```
5. Run the Server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
The frontend is built with vanilla HTML/CSS/JS and runs statically.
1. Serve the `frontend` folder using any static file server, for example:
   ```bash
   cd frontend
   npx serve .
   ```
2. By default, `api.js` points to `http://localhost:5000/api`. Ensure your backend is running.
3. Access the portal at: `http://localhost:3000` (or whichever port `serve` provides).

---

## 📅 Google Calendar Setup Steps

To enable automated calendar event creation for bookings:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Project and enable the **Google Calendar API**.
3. Navigate to **APIs & Services > Credentials**.
4. Configure the **OAuth Consent Screen** (Test mode is sufficient for local development).
5. Create **OAuth 2.0 Client IDs** (Application type: Web application).
6. Set the Authorized redirect URI to your backend route (e.g., `http://localhost:5000/api/auth/google/callback`).
7. Copy the **Client ID** and **Client Secret** to your `.env` file.
8. Authenticate once via the app to generate a **Refresh Token** and save it to `.env`.

---

## 🤖 LLM Prompts Used

The platform uses Google's Gemini-3.6-Flash model for medical text processing.

**Pre-Visit Symptom Summary Prompt:**
> "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Format as JSON with keys: urgencyLevel (string), summary (a single formatted string containing the chief complaint and the questions). Symptoms: `<symptoms>`"

**Post-Visit Clinical Notes Translation Prompt:**
> "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: `<notes>`"

---

## 💾 Database Schema Overview

The database uses PostgreSQL via Prisma ORM.

- **User**: Core authentication table with `Role` enum (`PATIENT`, `DOCTOR`, `ADMIN`). Stores basic patient health profiles.
- **DoctorProfile**: 1-to-1 extension of User for doctors. Stores specialisation, working hours, slot duration, and an array of `leaveDays`.
- **Appointment**: Tracks bookings linking Patient and Doctor. Fields include `appointmentDate`, `timeSlot`, and clinical data (`symptoms`, `preVisitSummary`, `postVisitNotes`, `postVisitSummary`). Partial Unique Indexes guarantee concurrency control preventing double-bookings.
- **NotificationQueue**: Table powering the asynchronous background worker. Tracks `type` (EMAIL, CALENDAR), `payload`, `status` (PENDING, FAILED, SUCCESS), and `retryCount`.

---

## 🌐 API Documentation

### Authentication
- `POST /api/auth/register` - Create patient account
- `POST /api/auth/login` - Authenticate and receive JWT
- `GET /api/auth/profile` - Fetch current user profile

### Booking & Appointments
- `GET /api/doctors/:id/availability?date=YYYY-MM-DD` - Fetch calculated, real-time slots (checking leave days and existing bookings)
- `POST /api/appointments/hold` - Holds a slot for 10 minutes while symptoms are filled
- `POST /api/appointments` - Finalizes booking, associates AI summary, queues Calendar + Email events
- `PATCH /api/appointments/:id/cancel` - Cancel appointment and notify peers

### AI Generation (Gemini)
- `POST /api/ai/pre-visit` - Generates symptom summary JSON
- `POST /api/ai/post-visit` - Generates patient-friendly clinical notes summary

### Doctor Management
- `GET /api/doctor/schedule?date=YYYY-MM-DD` - Fetch doctor's daily agenda
- `POST /api/doctor/appointments/:id/notes` - Submit post-visit notes/prescriptions and generate AI summary
- `POST /api/doctors/:id/leave` - Mark leave dates (automatically cancels & notifies affected appointments)

### Admin Operations
- `GET /api/admin/stats` - Fetch platform KPIs
- `POST /api/admin/doctors` - Provision new doctor accounts
