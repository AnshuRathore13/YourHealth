import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma";
import { AuthRequest } from "../middlewares/auth.middleware";

const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key_for_placement";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      email, password,
      // Accept both combined name or split first/last
      name: rawName, firstName, lastName,
      role,
      // Patient health profile fields (stored after schema migration)
      phone, dob, gender, bloodGroup, allergies, conditions,
    } = req.body;

    const fullName = rawName
      || [firstName, lastName].filter(Boolean).join(" ").trim()
      || "User";

    // Public register endpoint ONLY creates PATIENTS
    const userRole = "PATIENT";

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: fullName,
        role: userRole,
        // Health profile fields (included after running prisma migrate)
        ...(phone      ? { phone }      : {}),
        ...(dob        ? { dob }        : {}),
        ...(gender     ? { gender }     : {}),
        ...(bloodGroup ? { bloodGroup } : {}),
        ...(allergies  ? { allergies }  : {}),
        ...(conditions ? { conditions } : {}),
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Return JWT immediately so frontend auto-logs in after register
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id:        user.id,
        email:     user.email,
        name:      user.name,
        firstName: firstName || user.name.split(" ")[0],
        role:      user.role.toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id:        user.id,
        email:     user.email,
        name:      user.name,
        firstName: user.name.split(" ")[0],
        role:      user.role.toLowerCase(), // "patient" | "doctor" | "admin"
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, doctorProfile: true }
    });
    
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json(user);
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      res.json({ message: "If that email exists, a reset link has been sent." });
      return;
    }

    const { randomUUID } = require("crypto");
    const token = randomUUID();
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry }
    });

    await prisma.notificationQueue.create({
      data: {
        type: "EMAIL",
        payload: { email: user.email, name: user.name, token, type: "PASSWORD_RESET" }
      }
    });

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() } // expiry must be in the future
      }
    });

    if (!user) {
      res.status(400).json({ error: "Invalid or expired reset token." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({ message: "Password has been successfully reset. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
