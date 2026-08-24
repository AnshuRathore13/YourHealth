-- Migration: Extend DoctorProfile and User models for YourHealth v2
-- Run with: npx prisma db push  OR  npx prisma migrate dev --name extend_v2

-- Add missing columns to DoctorProfile
ALTER TABLE "DoctorProfile"
  ADD COLUMN IF NOT EXISTS "consultationFee" INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS "experience"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "bio"             TEXT,
  ADD COLUMN IF NOT EXISTS "rating"          DECIMAL(3,1) NOT NULL DEFAULT 4.5;

-- Add missing columns to User (patient health profile)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phone"       TEXT,
  ADD COLUMN IF NOT EXISTS "dob"         TEXT,
  ADD COLUMN IF NOT EXISTS "gender"      TEXT,
  ADD COLUMN IF NOT EXISTS "bloodGroup"  TEXT,
  ADD COLUMN IF NOT EXISTS "allergies"   TEXT,
  ADD COLUMN IF NOT EXISTS "conditions"  TEXT;

-- Fix NotificationQueue.status enum mismatch
-- The admin stats query uses status="SENT" but schema has SUCCESS
-- Add SENT as alias by updating enum (if Postgres supports)
-- Alternatively, update your query to use "SUCCESS" instead
