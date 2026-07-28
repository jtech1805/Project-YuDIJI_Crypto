import assert from "node:assert/strict";
import test from "node:test";

import { parseAngelLtpPacket } from "../../../../../src/integrations/market-data/angel/angel-ltp-packet.parser.js";

const buildLtpPacket = ({
  token = "570027",
  mode = 1,
  exchangeType = 5,
  sequenceNumber = 42n,
  exchangeTimestamp = 1781530253000n,
  rawLtp = 5250n,
} = {}): Buffer => {
  const buffer = Buffer.alloc(51);
  buffer.writeInt8(mode, 0);
  buffer.writeInt8(exchangeType, 1);
  buffer.write(token, 2, 25, "utf8");
  buffer.writeBigInt64LE(sequenceNumber, 27);
  buffer.writeBigInt64LE(exchangeTimestamp, 35);
  buffer.writeBigInt64LE(rawLtp, 43);
  return buffer;
};

test("parseAngelLtpPacket parses mode, exchange type, token, timestamp, and scaled price", () => {
  const packet = parseAngelLtpPacket(buildLtpPacket());

  assert.equal(packet.mode, 1);
  assert.equal(packet.exchangeType, 5);
  assert.equal(packet.token, "570027");
  assert.equal(packet.sequenceNumber, 42n);
  assert.equal(packet.exchangeTimestamp, 1781530253000);
  assert.equal(packet.ltp, 52.5);
});

test("parseAngelLtpPacket strips null characters from token", () => {
  const packet = parseAngelLtpPacket(buildLtpPacket({ token: "570027" }));

  assert.equal(packet.token, "570027");
});

test("parseAngelLtpPacket rejects short buffers", () => {
  assert.throws(
    () => parseAngelLtpPacket(Buffer.alloc(20)),
    /ANGEL_LTP_PACKET_PARSE_FAILED/,
  );
});
