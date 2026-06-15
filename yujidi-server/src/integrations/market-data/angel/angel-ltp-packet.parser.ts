import { AppError } from "../../../errors/AppError.js";

const ANGEL_LTP_PACKET_SIZE_BYTES = 51;
const TOKEN_OFFSET = 2;
const TOKEN_LENGTH_BYTES = 25;
const SEQUENCE_NUMBER_OFFSET = 27;
const EXCHANGE_TIMESTAMP_OFFSET = 35;
const LTP_OFFSET = 43;
const DEFAULT_PRICE_DIVISOR = 100;

export type AngelLtpPacket = {
  mode: number;
  exchangeType: number;
  token: string;
  sequenceNumber: bigint;
  exchangeTimestamp: number;
  ltp: number;
};

export function parseAngelLtpPacket(buffer: Buffer): AngelLtpPacket {
  if (buffer.length < ANGEL_LTP_PACKET_SIZE_BYTES) {
    throw new AppError("ANGEL_LTP_PACKET_PARSE_FAILED: packet is shorter than 51 bytes", 400);
  }

  try {
    const mode = buffer.readInt8(0);
    const exchangeType = buffer.readInt8(1);
    const token = buffer
      .subarray(TOKEN_OFFSET, TOKEN_OFFSET + TOKEN_LENGTH_BYTES)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();
    const sequenceNumber = buffer.readBigInt64LE(SEQUENCE_NUMBER_OFFSET);
    const exchangeTimestamp = Number(buffer.readBigInt64LE(EXCHANGE_TIMESTAMP_OFFSET));
    const rawLtp = Number(buffer.readBigInt64LE(LTP_OFFSET));

    return {
      mode,
      exchangeType,
      token,
      sequenceNumber,
      exchangeTimestamp,
      ltp: rawLtp / DEFAULT_PRICE_DIVISOR,
    };
  } catch (error: unknown) {
    throw new AppError(
      error instanceof Error
        ? `ANGEL_LTP_PACKET_PARSE_FAILED: ${error.message}`
        : "ANGEL_LTP_PACKET_PARSE_FAILED",
      400,
    );
  }
}
