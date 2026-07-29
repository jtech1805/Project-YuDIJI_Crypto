import assert from "node:assert/strict";
import test from "node:test";

import {
  EvidenceRepository,
  type EvidenceModelContract,
} from "../../../src/repositories/evidence.repository.js";
import type { EvidenceReadRecord } from "../../../src/types/evidence-lifecycle.types.js";

const AS_OF = new Date("2026-07-29T12:00:00.000Z");

const harness = () => {
  const finds: Array<{
    filter: Record<string, unknown>;
    sort?: Record<string, 1 | -1>;
    limit?: number;
  }> = [];
  const counts: Record<string, unknown>[] = [];
  const records: EvidenceReadRecord[] = [];
  const model: EvidenceModelContract = {
    create: async () => {
      throw new Error("unused");
    },
    findOne: () => ({ exec: async () => null }),
    find: (filter) => {
      const call: {
        filter: Record<string, unknown>;
        sort?: Record<string, 1 | -1>;
        limit?: number;
      } = { filter };
      finds.push(call);
      const query = {
        sort: (sort: Record<string, 1 | -1>) => {
          call.sort = sort;
          return query;
        },
        limit: (limit: number) => {
          call.limit = limit;
          return query;
        },
        lean: () => ({ exec: async () => records }),
      };
      return query;
    },
    countDocuments: (filter) => {
      counts.push(filter);
      return { exec: async () => 7 };
    },
  };
  return { counts, finds, repository: new EvidenceRepository(model) };
};

const baseParams = {
  factorKey: "GLOBAL.DXY",
  subjectType: "ECONOMY" as const,
  subjectKey: "MACRO:DXY",
  observedAtLte: AS_OF,
};

test("findHistory uses exact bounded filter, ordering, and limit", async () => {
  const { finds, repository } = harness();
  await repository.findHistory({ ...baseParams, limit: 200 });
  assert.deepEqual(finds, [{
    filter: {
      factorKey: "GLOBAL.DXY",
      "subject.type": "ECONOMY",
      "subject.key": "MACRO:DXY",
      observedAt: { $lte: AS_OF },
    },
    sort: { observedAt: 1, evidenceId: 1 },
    limit: 200,
  }]);
});

test("countHistory uses the same base filter without a read", async () => {
  const { counts, finds, repository } = harness();
  assert.equal(await repository.countHistory(baseParams), 7);
  assert.deepEqual(counts, [{
    factorKey: "GLOBAL.DXY",
    "subject.type": "ECONOMY",
    "subject.key": "MACRO:DXY",
    observedAt: { $lte: AS_OF },
  }]);
  assert.deepEqual(finds, []);
});

test("relationship read deduplicates IDs, filters asOf, sorts, and limits", async () => {
  const { finds, repository } = harness();
  const evidenceIds = ["A", "A", "B"];
  const before = [...evidenceIds];
  await repository.findRelationshipsTargeting({
    evidenceIds,
    observedAtLte: AS_OF,
    limit: 2000,
  });
  assert.deepEqual(evidenceIds, before);
  assert.deepEqual(finds, [{
    filter: {
      observedAt: { $lte: AS_OF },
      $or: [
        { revokesEvidenceId: { $in: ["A", "B"] } },
        { supersedesEvidenceId: { $in: ["A", "B"] } },
      ],
    },
    sort: { observedAt: 1, evidenceId: 1 },
    limit: 2000,
  }]);
});

test("relationship count uses the matching target filter", async () => {
  const { counts, repository } = harness();
  assert.equal(await repository.countRelationshipsTargeting({
    evidenceIds: ["A", "A"],
    observedAtLte: AS_OF,
  }), 7);
  assert.deepEqual(counts[0], {
    observedAt: { $lte: AS_OF },
    $or: [
      { revokesEvidenceId: { $in: ["A"] } },
      { supersedesEvidenceId: { $in: ["A"] } },
    ],
  });
});

test("empty relationship IDs avoid all model queries", async () => {
  const { counts, finds, repository } = harness();
  assert.deepEqual(await repository.findRelationshipsTargeting({
    evidenceIds: [],
    observedAtLte: AS_OF,
    limit: 2000,
  }), []);
  assert.equal(await repository.countRelationshipsTargeting({
    evidenceIds: [],
    observedAtLte: AS_OF,
  }), 0);
  assert.deepEqual(finds, []);
  assert.deepEqual(counts, []);
});

test("repository still exposes no mutation API", () => {
  const repository = harness().repository as unknown as Record<string, unknown>;
  for (const method of [
    "update", "updateOne", "findOneAndUpdate", "replace", "delete",
    "deleteOne", "remove", "upsert", "bulkWrite",
  ]) {
    assert.equal(repository[method], undefined);
  }
});
