# System Design Write-up

## 1. Double-Booking Prevention & Concurrency Control
In a multi-tenant appointment system, race conditions occur when two patients simultaneously attempt to book the same time slot with the same doctor. Application-level validation is insufficient to prevent this. 

**Solution:**
We implemented strict database-level concurrency control using **PostgreSQL Partial Unique Indexes**.
Two composite unique constraints were applied directly to the database schema:
1. `UNIQUE (doctorId, appointmentDate, timeSlot)` where `status IN ('PENDING', 'CONFIRMED')`
2. `UNIQUE (patientId, appointmentDate, timeSlot)` where `status IN ('PENDING', 'CONFIRMED')`

When multiple concurrent requests reach the backend to finalize a booking, the database enforces atomicity. The first transaction commits successfully, while the subsequent concurrent transaction is rejected by PostgreSQL with a unique constraint violation. The backend Prisma client catches this specific error code (`P2002`) and gracefully responds to the client with a `409 Conflict` HTTP status, instructing the frontend to inform the user that the slot was just taken. This guarantees zero double-bookings for doctors, and prevents patients from double-booking their own schedule.

## 2. Doctor Leave Conflict Handling
Doctors need the flexibility to mark themselves as unavailable, but doing so retroactively on dates with existing confirmed appointments requires delicate handling to maintain patient trust.

**Solution:**
When an admin or doctor submits an array of leave dates via the `/api/doctors/:id/leave` endpoint, the system executes a multi-step operation:
1. **Profile Update:** The `leaveDays` array on the `DoctorProfile` is immediately appended, ensuring no future bookings can be made on these dates. The availability generation algorithm cross-references this array and strips these dates from the frontend calendar.
2. **Conflict Resolution:** The backend queries the `Appointment` table for any `PENDING` or `CONFIRMED` appointments belonging to the doctor on the specified leave dates.
3. **Automated Cancellation & Notification:** The system iterates over the affected appointments, updating their status to `CANCELLED`. Simultaneously, it pushes a `DOCTOR_LEAVE_CANCELLATION` payload into the `NotificationQueue`. This decouples the heavy lifting of sending apology emails from the HTTP request, allowing the doctor's UI to remain fast and responsive while the background worker processes the affected patients.

## 3. Slot Hold Mechanism
To enhance user experience, patients are required to fill out a symptom form and wait for an LLM to generate a pre-visit summary before their booking is finalized. This multi-step process introduces a window where the slot could be sniped by another user.

**Solution:**
We implemented an optimistic "Soft Hold" mechanism. When a patient selects a time slot and proceeds to the symptom form, the frontend immediately fires a `/api/appointments/hold` request.
This request creates a skeleton `Appointment` record in the database with a status of `PENDING` and an `expiresAt` timestamp set to 10 minutes in the future.
Because our PostgreSQL unique indexes apply to both `CONFIRMED` and `PENDING` statuses, this immediately locks the slot, preventing anyone else from claiming it. If the patient abandons the symptom form, a background cron job periodically sweeps the database and deletes `PENDING` appointments where `expiresAt < now()`, safely releasing the slot back into the availability pool. When the patient finally confirms, the endpoint simply updates the existing held record with the AI summary and upgrades the status to `CONFIRMED`.

## 4. Notification Failure Handling
Healthcare applications require highly reliable communication (Emails, Calendar Invites, Medication Reminders). Relying on synchronous, in-line API calls to third-party providers (like Nodemailer/SendGrid or Google APIs) inside standard HTTP routes is prone to timeouts, rate limiting, and network failures.

**Solution:**
We designed an asynchronous, robust **Notification Queue Worker**.
Instead of sending emails or calendar invites directly, endpoints serialize the intent into a JSON payload and save it to the `NotificationQueue` table with a status of `PENDING`.

A dedicated Node-cron background worker constantly polls this table. When it picks up a job:
1. It attempts to execute the required external API call (e.g., Google Calendar `events.insert` or SMTP dispatch).
2. If successful, the job status is marked `SUCCESS`.
3. If the external provider fails (e.g., API timeout), the worker catches the error, increments a `retryCount` column, and logs the `errorMessage`. The job remains in the queue for the next tick.
4. If a job exceeds a predefined `MAX_RETRIES` threshold, it is marked as `FAILED`. 

This architecture guarantees that transient network errors do not result in dropped booking confirmations, and prevents third-party API latency from slowing down the patient/doctor user interfaces.
