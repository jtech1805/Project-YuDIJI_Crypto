import cors from "cors";
import cookieParser from "cookie-parser";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import pino, { type LoggerOptions } from "pino";
import crypto from "crypto"; // Built into Node.js for generating fallback request IDs
import { AppError } from "./errors/AppError.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { monitorRouter } from "./routes/monitor.routes.js";
import { alertRouter } from "./routes/alert.routes.js";
import chatRouter from "./routes/chat.routes.js";
import { brokerConnectionRouter } from "./routes/broker-connection.routes.js";
import { marketQuoteRouter } from "./routes/market-quote.routes.js";
import { marketStreamRouter } from "./routes/market-stream.routes.js";
import { scoreCheckRouter } from "./routes/score-check.routes.js";
import { symbolRouter } from "./routes/symbol.routes.js";
import { tradePlanRouter } from "./routes/trade-plan.routes.js";
import { tradeSetupRouter } from "./routes/trade-setup.routes.js";
import { activeTradeRouter } from "./routes/active-trade.routes.js";
import { tradeEventRouter } from "./routes/trade-event.routes.js";
import { tradeResultRouter } from "./routes/trade-result.routes.js";
import { tradeJournalRouter } from "./routes/trade-journal.routes.js";
import { aiExplanationRouter } from "./routes/ai-explanation.routes.js";
import { scoringContextRouter } from "./routes/scoring-context.routes.js";
import { scoringTemplateRouter } from "./routes/scoring-template.routes.js";
import { internalTemplateDraftRagRouter } from "./routes/internal-template-draft-rag.routes.js";
import { copilotRouter } from "./routes/copilot.routes.js";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// The Bulletproof CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  process.env.MEDO_URL,
].filter(Boolean) as string[];
app.use(
  cors({
    origin: allowedOrigins, // Fallback to local Vite
    credentials: true, // THIS IS REQUIRED FOR JWT COOKIES
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use((req: Request, _res: Response, next: NextFunction): void => {
  // 1. THE ANTI-SPAM FILTER
  // If this is the high-frequency LTP polling route, just skip logging entirely
  // (Adjust the string to match your exact LTP route path)
  if (req.path.includes("/ltp")) {
    return next();
  }

  // 2. ENRICHED REQUEST DATA
  // For all other routes, capture a deep diagnostic snapshot
  logger.info(
    {
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress,
      query: Object.keys(req.query).length ? req.query : undefined,

      // SECURITY WARNING: Never log the raw `req.body`.
      // It will leak passwords, JWTs, and bloat your log files.
      // Instead, log the keys so you know what the payload structure was.
      bodyKeys:
        req.body && typeof req.body === "object"
          ? Object.keys(req.body)
          : undefined,

      userAgent: req.headers["user-agent"],
      requestId: req.headers["x-request-id"] || crypto.randomUUID(),

      // Identify if the user was authenticated (assuming you attach `user` to `req` in your auth middleware)
      userId: (req as any).user?.id || "unauthenticated",
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
app.use("/api/chat", chatRouter);
app.use("/api/broker-connections", brokerConnectionRouter);
app.use("/api/market-quotes", marketQuoteRouter);
app.use("/api/market-streams", marketStreamRouter);
app.use("/api/score-checks", scoreCheckRouter);
app.use("/api/symbols", symbolRouter);
app.use("/api/trade-plans", tradePlanRouter);
app.use("/api/trade-setups", tradeSetupRouter);
app.use("/api/active-trades", activeTradeRouter);
app.use("/api/trade-events", tradeEventRouter);
app.use("/api/trade-results", tradeResultRouter);
app.use("/api/trade-journals", tradeJournalRouter);
app.use("/api/ai-explanations", aiExplanationRouter);
app.use("/api/scoring", scoringContextRouter);
app.use("/api/scoring-templates", scoringTemplateRouter);
app.use("/internal/ai/rag", internalTemplateDraftRagRouter);
app.use("/api/copilot", copilotRouter);

app.use((_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError("Route not found", 404));
});

app.use(errorHandler);

export { app, logger };
