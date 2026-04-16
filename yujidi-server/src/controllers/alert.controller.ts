import type { Request, Response,NextFunction } from "express";
import { AlertModel } from "../models/Alert.js";

// Get all alerts for the logged-in user, sorted by newest first
export const getUserAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user || (req as any).userId;
    const alerts = await AlertModel.find({ user: userId.id }).sort({ createdAt: -1 }).limit(50);
    res.status(200).json(alerts);
  } catch (error) {
    next(error);
  }
};

// Get a single detailed report
export const getAlertById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user || (req as any).userId;
    const alert = await AlertModel.findOne({ _id: req.params.id, user: userId });
    
    if (!alert) {
      res.status(404).json({ message: "Alert not found" });
      return;
    }
    res.status(200).json(alert);
  } catch (error) {
    next(error);
  }
};