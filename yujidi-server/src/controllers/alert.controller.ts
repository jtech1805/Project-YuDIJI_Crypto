import type { Request, Response, NextFunction } from "express";
import { AlertModel } from "../models/Alert.js";
import { getSymbolLtp } from "../services/binance.service.js";

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

export const getLtp = async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    if (!symbol) {
      return res.status(400).json({
        status: "error",
        message: "Symbol parameter is required (e.g., BTCUSDT)"
      });
    }

    const tickerData = await getSymbolLtp(symbol);

    // Return the exact JSON structure requested
    return res.status(200).json(tickerData);

  } catch (error: any) {
    console.error(`Error fetching LTP for ${req.params.symbol}:`, error.message);

    // Handle Binance 400 errors (e.g., invalid symbol)
    if (error.response && error.response.status === 400) {
      return res.status(400).json({ status: "error", message: "Invalid symbol provided to Binance" });
    }

    return res.status(500).json({ status: "error", message: "Failed to fetch ticker data" });
  }
};