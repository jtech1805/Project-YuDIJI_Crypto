import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { BrokerConnectionService } from "../services/market-data/broker-connection.service.js";

const connectAngelSchema = z.object({
  clientCode: z.string().min(1).max(64),
  apiKey: z.string().min(1).max(256),
  pin: z.string().min(1).max(64),
  totp: z.string().min(1).max(16),
  totpSecret: z.string().min(1).max(256).optional(),
});

const reconnectAngelSchema = connectAngelSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one reconnect field must be provided",
);

const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  return userId;
};

const getBrokerConnectionService = (): BrokerConnectionService => {
  return new BrokerConnectionService();
};

export const connectAngelConnection = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = connectAngelSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid Angel connection payload", 400);
  }

  const connection = await getBrokerConnectionService().connectAngelConnection(
    getUserId(req),
    {
      clientCode: parsedBody.data.clientCode,
      apiKey: parsedBody.data.apiKey,
      pin: parsedBody.data.pin,
      totp: parsedBody.data.totp,
      ...(parsedBody.data.totpSecret ? { totpSecret: parsedBody.data.totpSecret } : {}),
    },
  );

  res.status(201).json({
    status: "success",
    data: connection,
  });
};

export const getBrokerConnections = async (req: Request, res: Response): Promise<void> => {
  const connections = await getBrokerConnectionService().getConnections(getUserId(req));

  res.status(200).json({
    status: "success",
    data: connections,
  });
};

export const getAngelConnectionStatus = async (req: Request, res: Response): Promise<void> => {
  const connection = await getBrokerConnectionService().getAngelStatus(getUserId(req));

  res.status(200).json({
    status: "success",
    data: connection,
  });
};

export const reconnectAngelConnection = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = reconnectAngelSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid Angel reconnect payload", 400);
  }

  const reconnectDto: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsedBody.data)) {
    if (typeof value === "string") {
      reconnectDto[key] = value;
    }
  }

  const connection = await getBrokerConnectionService().reconnectAngel(getUserId(req), reconnectDto);

  res.status(200).json({
    status: "success",
    data: connection,
  });
};

export const deleteAngelConnection = async (req: Request, res: Response): Promise<void> => {
  const connection = await getBrokerConnectionService().deleteAngelConnection(getUserId(req));

  res.status(200).json({
    status: "success",
    data: connection,
  });
};
