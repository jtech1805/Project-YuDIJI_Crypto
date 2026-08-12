import assert from "node:assert/strict";
import test from "node:test";

import { TemplateResourceResolverService } from "../../../src/services/templates/template-resource-resolver.service.js";

const leanResult = <T>(value: T) => ({
  lean: () => ({ exec: async () => value }),
});

test("India resource resolver scopes Angel snapshots by user", async () => {
  const filters: Record<string, unknown>[] = [];
  const requestedKeys: string[] = [];
  const records = [
    {
      _id: "index-id",
      provider: "ANGEL_ONE",
      exchange: "NSE",
      symbol: "NIFTY50",
      providerSymbol: "NIFTY 50",
      instrumentToken: "99926000",
      status: "ACTIVE",
    },
    {
      _id: "vix-id",
      provider: "ANGEL_ONE",
      exchange: "NSE",
      symbol: "INDIA_VIX",
      providerSymbol: "INDIA VIX",
      instrumentToken: "99926017",
      status: "ACTIVE",
    },
  ];
  const service = new TemplateResourceResolverService({
    symbolRepository: {
      findOne: (filter) => {
        filters.push(filter);
        return leanResult(records.shift() ?? null);
      },
    },
    marketSnapshotService: {
      getSnapshot: (resourceKey) => {
        requestedKeys.push(resourceKey);
        return null;
      },
    },
  });

  const resources = await service.resolveIndiaEquityResources({
    userId: "user-a",
  });

  assert.equal(resources.index.resourceKey, "ANGEL_ONE:user-a:NSE:99926000");
  assert.equal(resources.sector.reasonCode, "SECTOR_MAPPING_UNAVAILABLE");
  assert.equal(resources.vix.resourceKey, "ANGEL_ONE:user-a:NSE:99926017");
  assert.deepEqual(requestedKeys, [
    "ANGEL_ONE:user-a:NSE:99926000",
    "ANGEL_ONE:user-a:NSE:99926017",
  ]);
  assert.equal(filters.length, 2);
});
