import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { AngelScripMasterClient } from "../../../../../src/integrations/market-data/angel/angel-scrip-master.client.js";
import type { AngelScripMasterRow } from "../../../../../src/integrations/market-data/angel/angel-scrip-master.types.js";

const sampleRow: AngelScripMasterRow = {
  token: "253456",
  symbol: "CRUDEOIL26JUN7200CE",
  name: "CRUDEOIL",
  expiry: "26JUN2026",
  strike: "720000.000000",
  lotsize: "100",
  instrumenttype: "OPTFUT",
  exch_seg: "MCX",
  tick_size: "100.000000",
};

test("AngelScripMasterClient can load rows from a local JSON file", async () => {
  const folder = await mkdtemp(join(tmpdir(), "angel-scrip-master-"));
  const filePath = join(folder, "OpenAPIScripMaster.json");

  try {
    await writeFile(filePath, JSON.stringify([sampleRow]), "utf8");

    const client = new AngelScripMasterClient(undefined, { filePath });
    const rows = await client.fetchScripMaster();

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.token, "253456");
    assert.equal(rows[0]?.symbol, "CRUDEOIL26JUN7200CE");
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

