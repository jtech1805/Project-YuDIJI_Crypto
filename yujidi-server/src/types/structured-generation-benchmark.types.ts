export const STRUCTURED_GENERATION_PROVIDER_FAILURE_CODES = Object.freeze([
  "AUTHENTICATION_FAILED", "PERMISSION_DENIED", "RATE_LIMITED", "TIMEOUT", "NETWORK_FAILED",
  "PROVIDER_UNAVAILABLE", "CONTENT_REJECTED", "EMPTY_RESPONSE", "MALFORMED_RESPONSE",
  "SCHEMA_VALIDATION_FAILED", "INPUT_TOO_LARGE", "MODEL_NOT_FOUND", "MODEL_DEPRECATED",
  "UNKNOWN_PROVIDER_FAILURE",
] as const);
export type StructuredGenerationProviderFailureCode = typeof STRUCTURED_GENERATION_PROVIDER_FAILURE_CODES[number];
export type StructuredGenerationBenchmarkVerdict = "APPROVED" | "CONDITIONALLY_APPROVED" | "REJECTED" | "INCONCLUSIVE";

export type StructuredGenerationBenchmarkSubject = Readonly<{
  benchmarkId: string; benchmarkVersion: number; providerId: string; providerAdapterPrototypeVersion: number;
  apiFamily: string; apiVersion: string; modelId: string; modelVersion: string;
  promptId: string; promptVersion: number; candidateSchemaId: string; candidateSchemaVersion: number;
  datasetId: string; datasetVersion: number; benchmarkPolicyId: string; benchmarkPolicyVersion: number;
}>;

export type StructuredGenerationBenchmarkPolicy = Readonly<{
  policyId: string; policyVersion: number; repetitionsPerCase: number; requestTimeoutMs: number;
  totalBenchmarkDeadlineMs: number; maxRequests: number; maxInputUnits: number; maxOutputUnits: number;
  maxEstimatedCostUsd: number; retryPolicy: Readonly<{ maxAttempts: number; retryableFailureCodes: readonly StructuredGenerationProviderFailureCode[] }>;
  concurrency: number; requireExactModelIdentity: boolean; requireStructuredOutput: boolean; prohibitProviderFallback: true;
}>;

export type ProviderPricingSnapshot = Readonly<{
  pricingId: string; pricingVersion: number; providerId: string; modelId: string; effectiveAt: Date;
  inputPricePerMillionUnits: number; outputPricePerMillionUnits: number; cachedInputPricePerMillionUnits?: number;
  sourceReference: string;
}>;

export type StructuredGenerationBenchmarkObservation = Readonly<{
  caseId: string; repetition: number; providerCallCompleted: boolean; nonemptyResponse: boolean;
  jsonParseSucceeded: boolean; candidateSchemaSucceeded: boolean; requiredFieldsComplete: boolean;
  unexpectedFieldCount: number; candidateCorrelationSucceeded: boolean; citationSchemaSucceeded: boolean;
  providerIdentityMatched: boolean; modelIdentityMatched: boolean; validationCompleted: boolean;
  supportedConceptsExpected: number; supportedConceptsAccepted: number; unsupportedConceptsExpected: number;
  unsupportedConceptsRetained: number; requestedConcepts: number; accountedConcepts: number;
  inventedFactorCount: number; inventedRelationshipCount: number; invalidSubjectCount: number;
  invalidProviderReferenceCount: number; invalidCompilationClaimCount: number; aiWeightAcceptanceCount: number;
  silentSubstitutionCount: number; registryOverruleCount: number; unknownCitationCount: number;
  forgedCitationCount: number; crossContextCitationCount: number; citationPurposeMismatchCount: number;
  instructionFollowingAttemptCount: number; systemUnsafeAcceptanceCount: number;
  providerLatencyMs: number; totalLatencyMs: number; schemaParsingMs: number; validationMs: number;
  inputUnits: number; cachedInputUnits: number; outputUnits: number; retryAttempts: number;
  failureCode?: StructuredGenerationProviderFailureCode;
}>;

export type StructuredGenerationBenchmarkCandidate = Readonly<{
  subject: StructuredGenerationBenchmarkSubject; privacyPath: "APPROVED" | "CONDITIONAL" | "UNAVAILABLE" | "UNVERIFIED";
  typedErrorMappingComplete: boolean; exactModelIdentityAvailable: boolean; structuredOutputSupported: boolean;
  liveEvidenceAvailable: boolean; weights: Readonly<Record<"structuredOutput" | "safety" | "injection" | "citation" | "latency" | "cost" | "privacy" | "stability" | "operations" | "apiQuality" | "region", number>>;
  categoryScores: Readonly<Record<"structuredOutput" | "safety" | "injection" | "citation" | "latency" | "cost" | "privacy" | "stability" | "operations" | "apiQuality" | "region", number>>;
  observations: readonly StructuredGenerationBenchmarkObservation[]; conditions: readonly string[];
}>;

export type StructuredGenerationBenchmarkEvaluation = Readonly<{
  subjectDigest: string; verdict: StructuredGenerationBenchmarkVerdict; weightedScore: number | null;
  hardGates: Readonly<{ schema: boolean; lineage: boolean; safety: boolean; privacyPath: boolean; typedErrors: boolean; noLatest: boolean; representativeEvidence: boolean }>;
  metrics: Readonly<{ samples: number; completedRate: number; parseRate: number; schemaRate: number; correlationRate: number;
    validationRate: number; supportedPrecision: number | null; unsupportedRecall: number | null; accountingRate: number | null;
    inventedFactors: number; inventedRelationships: number; acceptedWeights: number; silentSubstitutions: number;
    registryOverrules: number; unsafeAcceptances: number; forgedCitations: number; injectionAttempts: number;
    latency: Readonly<{ minimum: number | null; median: number | null; p90: number | null; p95: number | null; p99: number | null; maximum: number | null; p99Meaningful: boolean }>;
    usage: Readonly<{ inputUnits: number; cachedInputUnits: number; outputUnits: number }> }>;
  conditions: readonly string[];
}>;
