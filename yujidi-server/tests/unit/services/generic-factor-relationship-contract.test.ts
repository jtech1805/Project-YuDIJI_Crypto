import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERIC_FACTOR_RELATIONSHIP_SUPPORT_STATES,
  GENERIC_FACTOR_RELATIONSHIP_TYPES,
  classifyGenericFactorRelationship,
} from "../../../src/types/generic-factor-relationship.types.js";

test("generic relationship vocabulary is exact, unique, and frozen", () => {
  assert.deepEqual(GENERIC_FACTOR_RELATIONSHIP_TYPES, [
    "DIRECT", "INVERSE", "CONDITIONAL", "CONFIRMATION_ONLY", "RISK_ONLY", "VETO",
  ]);
  assert.equal(new Set(GENERIC_FACTOR_RELATIONSHIP_TYPES).size, 6);
  assert.equal(Object.isFrozen(GENERIC_FACTOR_RELATIONSHIP_TYPES), true);
  assert.equal(Object.isFrozen(GENERIC_FACTOR_RELATIONSHIP_SUPPORT_STATES), true);
});

test("generic relationship classification preserves semantic ownership", () => {
  assert.deepEqual(classifyGenericFactorRelationship("DIRECT"), {
    relationshipType: "DIRECT", supportState: "SINGLE_FACTOR_EXECUTABLE",
    producesDirectionalContribution: true,
  });
  assert.equal(classifyGenericFactorRelationship("INVERSE")?.supportState,
    "SINGLE_FACTOR_EXECUTABLE");
  assert.equal(classifyGenericFactorRelationship("CONDITIONAL")?.supportState,
    "CONDITION_BINDING_REQUIRED");
  assert.equal(classifyGenericFactorRelationship("CONFIRMATION_ONLY")?.supportState,
    "CROSS_FACTOR_DEFERRED");
  assert.equal(classifyGenericFactorRelationship("RISK_ONLY")?.supportState,
    "RISK_AXIS_DEFERRED");
  assert.equal(classifyGenericFactorRelationship("VETO")?.supportState,
    "VETO_CHANNEL_DEFERRED");
  assert.equal(Object.isFrozen(classifyGenericFactorRelationship("VETO")), true);
});

test("unknown relationships fail closed deterministically", () => {
  assert.equal(classifyGenericFactorRelationship("direct"), null);
  assert.equal(classifyGenericFactorRelationship("UNKNOWN"), null);
  assert.equal(classifyGenericFactorRelationship(null), null);
});
