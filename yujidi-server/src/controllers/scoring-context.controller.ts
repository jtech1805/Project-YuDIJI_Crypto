import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { ScoringContextService } from "../services/scoring-context.service.js";
import { SCORING_TEMPLATE_KEYS } from "../types/scoring.types.js";

const querySchema = z.object({
  symbolId: z.string().optional(),
  symbol: z.string().optional(),
  provider: z.string().optional(),
  exchange: z.string().optional(),
  instrumentToken: z.string().optional(),
  indexSymbolId: z.string().optional(),
  sectorSymbolId: z.string().optional(),
  vixSymbolId: z.string().optional(),
  templateKey: z.enum(SCORING_TEMPLATE_KEYS).optional(),
  includeBuffers: z.enum(["true", "false"]).optional(),
  bufferLimit: z.coerce.number().int().positive().optional(),
});

export const getRealtimeScoringContext = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) throw new AppError("Authentication required", 401);
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError("Invalid scoring context query", 400);
  const input: Parameters<ScoringContextService["getRealtimeContext"]>[0] = {
    userId: req.user.id,
    includeBuffers: parsed.data.includeBuffers === "true",
    ...(parsed.data.symbolId ? { symbolId: parsed.data.symbolId } : {}),
    ...(parsed.data.symbol ? { symbol: parsed.data.symbol } : {}),
    ...(parsed.data.provider ? { provider: parsed.data.provider } : {}),
    ...(parsed.data.exchange ? { exchange: parsed.data.exchange } : {}),
    ...(parsed.data.instrumentToken ? { instrumentToken: parsed.data.instrumentToken } : {}),
    ...(parsed.data.indexSymbolId ? { indexSymbolId: parsed.data.indexSymbolId } : {}),
    ...(parsed.data.sectorSymbolId ? { sectorSymbolId: parsed.data.sectorSymbolId } : {}),
    ...(parsed.data.vixSymbolId ? { vixSymbolId: parsed.data.vixSymbolId } : {}),
    ...(parsed.data.templateKey ? { templateKey: parsed.data.templateKey } : {}),
    ...(parsed.data.bufferLimit !== undefined ? { bufferLimit: parsed.data.bufferLimit } : {}),
  };
  const data = await new ScoringContextService().getRealtimeContext(input);
  res.status(200).json({ status: "success", data });
};
