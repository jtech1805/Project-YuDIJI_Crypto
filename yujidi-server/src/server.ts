import "dotenv/config";

import type { Server } from "node:http";

import mongoose from "mongoose";
import { z } from "zod";

import { app, logger } from "./app.js";
import { syncBinanceSymbols } from "./services/binance.service.js";
// import { WebSocketManager } from "./services/websocket.service.js";
import { sharedWebsocketManager } from "./services/websocket.service.js";
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
// const websocketManager = new WebSocketManager();

const MONGO_CONNECT_MAX_ATTEMPTS = 5;
const MONGO_CONNECT_RETRY_DELAY_MS = 5000;
const BINANCE_SYMBOL_SYNC_RETRY_DELAY_MS = 5 * 60 * 1000;

const sleep = (milliseconds: number): Promise<void> => {
  return new Promise((resolve): void => {
    setTimeout(resolve, milliseconds);
  });
};

const connectMongoWithRetry = async (): Promise<void> => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MONGO_CONNECT_MAX_ATTEMPTS; attempt += 1) {
    try {
      await mongoose.connect(MONGO_URI);
      logger.info({ attempt }, "MongoDB connection established");
      return;
    } catch (error: unknown) {
      lastError = error;
      const hasMoreAttempts = attempt < MONGO_CONNECT_MAX_ATTEMPTS;
      logger.error(
        {
          error,
          attempt,
          maxAttempts: MONGO_CONNECT_MAX_ATTEMPTS,
          retryDelayMs: hasMoreAttempts ? MONGO_CONNECT_RETRY_DELAY_MS : undefined,
        },
        hasMoreAttempts
          ? "MongoDB connection failed; retrying"
          : "MongoDB connection failed; no retries remaining",
      );

      if (hasMoreAttempts) {
        await sleep(MONGO_CONNECT_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("MongoDB connection failed");
};

const runBinanceSymbolSyncLoop = (): void => {
  const syncOnce = async (): Promise<void> => {
    try {
      const syncedCount = await syncBinanceSymbols();
      logger.info({ syncedCount }, "Binance symbols synchronized");
    } catch (error: unknown) {
      logger.error(
        {
          error,
          retryDelayMs: BINANCE_SYMBOL_SYNC_RETRY_DELAY_MS,
        },
        "Binance symbol synchronization failed; retrying in background",
      );

      setTimeout((): void => {
        void syncOnce();
      }, BINANCE_SYMBOL_SYNC_RETRY_DELAY_MS);
    }
  };

  void syncOnce();
};

const startServer = async (): Promise<void> => {
  await connectMongoWithRetry();

  server = app.listen(PORT, (): void => {
    logger.info({ port: PORT }, "HTTP server started");
  });

  // websocketManager.initialize(server);
  // 3. USE THE SHARED INSTANCE HERE
  sharedWebsocketManager.initialize(server);
  logger.info("WebSocket manager initialized");
  runBinanceSymbolSyncLoop();
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
