import assert from "node:assert/strict";
import test from "node:test";

import { calculateStructuralSupportResistance } from "../../../src/services/trading/analyzer-order-book-calculation.js";

test("order-book calculation returns the established unavailable projection", () => {
  const expected = {
    currentPrice: "Unknown",
    support: "Unknown",
    resistance: "Unknown",
  };
  assert.deepEqual(calculateStructuralSupportResistance(undefined), expected);
  assert.deepEqual(calculateStructuralSupportResistance({ bids: [], asks: [] }), expected);
  assert.deepEqual(calculateStructuralSupportResistance({ bids: [[]], asks: [[]] }), expected);
});

test("order-book calculation ignores three noise levels and preserves dynamic wall arithmetic", () => {
  const result = calculateStructuralSupportResistance({
    bids: [
      ["100", "1000"],
      ["99", "1000"],
      ["98", "1000"],
      ["97", "1"],
      ["96.5", "1"],
      ["96.25", "1"],
      ["96", "10"],
    ],
    asks: [
      ["102", "1000"],
      ["103", "1000"],
      ["104", "1000"],
      ["105", "1"],
      ["105.5", "1"],
      ["105.75", "1"],
      ["106", "10"],
    ],
  });

  assert.deepEqual(result, {
    currentPrice: "$101",
    support: "$96 (10.00 coins)",
    resistance: "$106 (10.00 coins)",
    rawCurrentPrice: 101,
    rawSupport: 96,
    rawResistance: 106,
    debugData: {
      averageBid: "3.25",
      requiredBidWall: "8.13",
      averageAsk: "3.25",
      requiredAskWall: "8.13",
    },
  });
});

test("order-book calculation skips malformed levels and preserves no-wall output", () => {
  const result = calculateStructuralSupportResistance({
    bids: [["100", "1"], ["99", "1"], ["98", "1"], ["bad", "bad"]],
    asks: [["102", "1"], ["103", "1"], ["104", "1"], ["bad", "bad"]],
  });
  assert.equal(result.support, "No strong support found");
  assert.equal(result.resistance, "No strong resistance found");
  assert.equal(result.rawSupport, 0);
  assert.equal(result.rawResistance, 0);
});
