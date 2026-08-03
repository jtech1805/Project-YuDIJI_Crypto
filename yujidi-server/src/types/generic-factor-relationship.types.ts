export const GENERIC_FACTOR_RELATIONSHIP_TYPES = Object.freeze([
  "DIRECT",
  "INVERSE",
  "CONDITIONAL",
  "CONFIRMATION_ONLY",
  "RISK_ONLY",
  "VETO",
] as const);
export type GenericFactorRelationshipType =
  (typeof GENERIC_FACTOR_RELATIONSHIP_TYPES)[number];

export const GENERIC_FACTOR_RELATIONSHIP_SUPPORT_STATES = Object.freeze([
  "SINGLE_FACTOR_EXECUTABLE",
  "CONDITION_BINDING_REQUIRED",
  "CROSS_FACTOR_DEFERRED",
  "RISK_AXIS_DEFERRED",
  "VETO_CHANNEL_DEFERRED",
] as const);
export type GenericFactorRelationshipSupportState =
  (typeof GENERIC_FACTOR_RELATIONSHIP_SUPPORT_STATES)[number];

export type GenericFactorRelationshipClassification = Readonly<{
  relationshipType: GenericFactorRelationshipType;
  supportState: GenericFactorRelationshipSupportState;
  producesDirectionalContribution: boolean;
}>;

const CLASSIFICATIONS: Readonly<Record<
  GenericFactorRelationshipType,
  GenericFactorRelationshipClassification
>> = Object.freeze({
  DIRECT: classification("DIRECT", "SINGLE_FACTOR_EXECUTABLE", true),
  INVERSE: classification("INVERSE", "SINGLE_FACTOR_EXECUTABLE", true),
  CONDITIONAL: classification("CONDITIONAL", "CONDITION_BINDING_REQUIRED", true),
  CONFIRMATION_ONLY: classification("CONFIRMATION_ONLY", "CROSS_FACTOR_DEFERRED", false),
  RISK_ONLY: classification("RISK_ONLY", "RISK_AXIS_DEFERRED", false),
  VETO: classification("VETO", "VETO_CHANNEL_DEFERRED", false),
});

export const classifyGenericFactorRelationship = (
  value: unknown,
): GenericFactorRelationshipClassification | null => {
  if (typeof value !== "string"
    || !GENERIC_FACTOR_RELATIONSHIP_TYPES.includes(
      value as GenericFactorRelationshipType,
    )) return null;
  return CLASSIFICATIONS[value as GenericFactorRelationshipType];
};

function classification(
  relationshipType: GenericFactorRelationshipType,
  supportState: GenericFactorRelationshipSupportState,
  producesDirectionalContribution: boolean,
): GenericFactorRelationshipClassification {
  return Object.freeze({
    relationshipType,
    supportState,
    producesDirectionalContribution,
  });
}
