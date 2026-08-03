import assert from "node:assert/strict";
import test from "node:test";
import { compiledRulebookSchema } from "../../../src/models/compiled-rulebook.model.js";

test("compiled rulebook schema freezes authoritative and supporting indexes", () => {
  const indexes = compiledRulebookSchema.indexes();
  assert(indexes.some(([keys, options]) => JSON.stringify(keys) === JSON.stringify({ rulebookId: 1, rulebookVersion: 1 }) && options.unique === true));
  assert(indexes.some(([keys]) => "compilation.compilationInputHash" in keys));
  assert(indexes.some(([keys]) => "sourceTemplate.templateId" in keys && "compilation.compiledAt" in keys));
  assert.equal(indexes.some(([keys, options]) => "sourceTemplate.templateId" in keys && "sourceTemplate.templateVersion" in keys && options.unique === true), false);
});
test("schema has no mutable lifecycle timestamps or activation fields", () => {
  for (const path of ["status", "isActive", "isLatest", "executionCount", "lastExecutedAt", "updatedAt", "createdAt"]) assert.equal(compiledRulebookSchema.path(path), undefined);
});
