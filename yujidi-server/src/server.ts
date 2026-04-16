import "dotenv/config";

import type { Server } from "node:http";

import mongoose from "mongoose";
import { z } from "zod";

import { app, logger } from "./app.js";
import { syncBinanceSymbols } from "./services/binance.service.js";
import { WebSocketManager } from "./services/websocket.service.js";

const envSchema = z.object({
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  PORT: z.coerce.number().int().positive("PORT must be a positive integer"),
});

const env = envSchema.safeParse(process.env);
if (!env.success) {
  const formattedErrors = env.error.issues.map((issue): string => issue.message).join("; ");
  throw new Error(`Environment validation failed: ${formattedErrors}`);
}

const { MONGO_URI, PORT } = env.data;

let server: Server | null = null;
const websocketManager = new WebSocketManager();

const startServer = async (): Promise<void> => {
  await mongoose.connect(MONGO_URI);
  logger.info("MongoDB connection established");

  const syncedCount = await syncBinanceSymbols();
  logger.info({ syncedCount }, "Binance symbols synchronized");

  server = app.listen(PORT, (): void => {
    logger.info({ port: PORT }, "HTTP server started");
  });

  websocketManager.initialize(server);
  logger.info("WebSocket manager initialized");
};

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, "Shutdown initiated");

  if (server !== null) {
    await new Promise<void>((resolve, reject): void => {
      server?.close((closeError?: Error): void => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    });
  }

  await mongoose.disconnect();
  logger.info("MongoDB disconnected and server closed");
  process.exit(0);
};

process.on("SIGINT", (): void => {
  shutdown("SIGINT").catch((error: unknown): void => {
    logger.error({ error }, "Graceful shutdown failed");
    process.exit(1);
  });
});

process.on("SIGTERM", (): void => {
  shutdown("SIGTERM").catch((error: unknown): void => {
    logger.error({ error }, "Graceful shutdown failed");
    process.exit(1);
  });
});

startServer().catch((error: unknown): void => {
  logger.fatal({ error }, "Server bootstrap failed");
  process.exit(1);
});
