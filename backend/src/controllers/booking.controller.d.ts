import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
export declare const searchDoctors: (req: Request, res: Response) => Promise<void>;
export declare const getDoctorAvailability: (req: Request, res: Response) => Promise<void>;
export declare const holdSlot: (req: AuthRequest, res: Response) => Promise<void>;
export declare const confirmBooking: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=booking.controller.d.ts.map