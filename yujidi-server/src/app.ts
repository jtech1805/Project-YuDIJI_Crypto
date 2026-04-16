import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import pino, { type LoggerOptions } from "pino";

import { AppError } from "./errors/AppError.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { monitorRouter } from "./routes/monitor.routes.js";
import { alertRouter } from "./routes/alert.routes.js";

const loggerOptions: LoggerOptions = {
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
};

if (process.env.NODE_ENV !== "production") {
  loggerOptions.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  };
}

const logger = pino(loggerOptions);

const app: Express = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "https://project-yu-diji-crypto-a1qwh8ahv-jtech1805-7503s-projects.vercel.app"], // The exact URL of your Vite frontend (NO trailing slash!)
    credentials: true,               // THIS is what allows the httpOnly cookies to pass
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use((req: Request, _res: Response, next: NextFunction): void => {
  logger.info(
    {
      method: req.method,
      path: req.path,
      requestId: req.headers["x-request-id"],
    },
    "Incoming request",
  );
  next();
});

app.get("/health", (_req: Request, res: Response): void => {
  res.status(200).json({
    status: "ok",
    service: "yujidi-server",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/monitors", monitorRouter);
app.use("/api/alerts", alertRouter);

app.use((_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError("Route not found", 404));
});

app.use(errorHandler);

export { app, logger };
