import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import {
  ScoringTemplateModel,
  type ScoringTemplate,
} from "../models/scoring-template.model.js";
import { SymbolModel } from "../models/Symbol.js";
import {
  INSTRUMENT_TYPES,
  MARKET_TYPES,
  type InstrumentType,
  type MarketType,
} from "../types/market-data.types.js";
import {
  MISSING_DATA_POLICIES,
  SCORING_TEMPLATE_KEYS,
  type EditableScoringSectionDefinition,
  type ResolvedScoringTemplateDefinition,
  type ScoringPermissionThresholds,
  type ScoringTemplateResourceConfig,
  type ScoringTemplateSectionOverride,
  type ScoringTemplateSnapshotPolicy,
  type ScoringTemplateKey,
} from "../types/scoring.types.js";
import {
  DEFAULT_SCORING_PERMISSION_THRESHOLDS,
  ScoringTemplateRegistryService,
} from "./scoring-template-registry.service.js";
import { ScoringTemplateValidationService } from "./scoring-template-validation.service.js";

const templateThresholdsSchema = z.object({
  rejectBelow: z.number().min(0).max(100),
  waitBelow: z.number().min(0).max(100),
  takeSmallRiskBelow: z.number().min(0).max(100),
  takeTradeAtOrAbove: z.number().min(0).max(100),
}).strict();

const evaluatorSchema = z.object({
  evaluatorKey: z.string().min(1).max(100).transform((value) => value.trim().toUpperCase()),
  label: z.string().min(1).max(120).transform((value) => value.trim()),
  weight: z.number().min(0).max(100),
  enabled: z.boolean().default(true),
  missingDataPolicy: z.enum(MISSING_DATA_POLICIES).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
}).strict();

const sectionSchema = z.object({
  sectionKey: z.string().min(1).max(100).transform((value) => value.trim().toUpperCase()),
  label: z.string().min(1).max(120).transform((value) => value.trim()),
  weight: z.number().min(0).max(100),
  enabled: z.boolean().default(true),
  missingDataPolicy: z.enum(MISSING_DATA_POLICIES),
  evaluators: z.array(evaluatorSchema).min(1),
}).strict();

const objectIdStringSchema = z.string().refine((value) => isValidObjectId(value), "Invalid symbol id");

const resourceConfigSchema = z.object({
  marketRegime: z.object({
    marketIndexSymbolId: objectIdStringSchema.optional(),
    bankIndexSymbolId: objectIdStringSchema.optional(),
    volatilitySymbolId: objectIdStringSchema.optional(),
  }).strict().optional(),
  sectorContext: z.object({
    sectorName: z.string().max(120).transform((value) => value.trim()).optional(),
    sectorIndexSymbolId: objectIdStringSchema.optional(),
  }).strict().optional(),
  relatedSymbols: z.array(objectIdStringSchema).max(50).optional(),
}).strict();

const sectionOverrideSchema = z.object({
  sectionKey: z.string().min(1).max(100).transform((value) => value.trim().toUpperCase()),
  weight: z.number().min(0).max(100),
  enabled: z.boolean().default(true),
}).strict();

const snapshotPolicySchema = z.object({
  captureMarketRegime: z.boolean().default(true),
  captureSectorContext: z.boolean().default(true),
  captureRelatedSymbols: z.boolean().default(true),
  captureAllowedTradableSymbol: z.boolean().default(true),
  maxSnapshotAgeSeconds: z.number().int().min(0).max(86400).default(900),
}).strict();

export const duplicateScoringTemplateSchema = z.object({
  templateName: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  resourceConfig: resourceConfigSchema.optional(),
  allowedTradableSymbols: z.array(objectIdStringSchema).max(500).optional(),
  sectionOverrides: z.array(sectionOverrideSchema).min(1).optional(),
  snapshotPolicy: snapshotPolicySchema.optional(),
}).strict();

export const updateScoringTemplateSchema = z.object({
  templateName: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  sections: z.array(sectionSchema).min(1).optional(),
  permissionThresholds: templateThresholdsSchema.optional(),
  resourceConfig: resourceConfigSchema.optional(),
  allowedTradableSymbols: z.array(objectIdStringSchema).max(500).optional(),
  sectionOverrides: z.array(sectionOverrideSchema).min(1).optional(),
  snapshotPolicy: snapshotPolicySchema.optional(),
}).strict();

export type DuplicateScoringTemplateInput = z.infer<typeof duplicateScoringTemplateSchema>;
export type UpdateScoringTemplateInput = z.infer<typeof updateScoringTemplateSchema>;
export type CreateUserDraftTemplateInput = Readonly<{ userId: string; templateKey: string; baseTemplateKey: ScoringTemplateKey; templateName: string; description?: string; marketType: MarketType; tradeStyle: string; instrumentType: InstrumentType; sections: readonly EditableScoringSectionDefinition[] }>;

export type ScoringTemplateSummary = {
  id?: string;
  templateKey: string;
  baseTemplateKey: ScoringTemplateKey;
  templateName: string;
  description?: string;
  scope: "SYSTEM" | "USER";
  version: number;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  isReadonly: boolean;
  isLatest: boolean;
  usedCount: number;
  lastUsedAt?: Date;
  resourceConfig?: ScoringTemplateResourceConfig;
  allowedTradableSymbols?: string[];
  sectionOverrides?: ScoringTemplateSectionOverride[];
  snapshotPolicy?: ScoringTemplateSnapshotPolicy;
};

export class ScoringTemplateCrudService {
  public constructor(
    private readonly registry = new ScoringTemplateRegistryService(),
    private readonly validator = new ScoringTemplateValidationService(),
    private readonly dependencies: {
      countSymbolsByIds?: (symbolIds: Types.ObjectId[]) => Promise<number>;
    } = {},
  ) {}

  public async listAvailableTemplates(userId: string): Promise<ScoringTemplateSummary[]> {
    const userObjectId = this.toObjectId(userId, "user id");
    const userTemplates = await ScoringTemplateModel.find({
      userId: userObjectId,
      status: { $ne: "ARCHIVED" },
      isLatest: true,
    }).sort({ updatedAt: -1 }).lean().exec();

    return [
      ...this.registry.list().map((template) => ({
        templateKey: template.key,
        baseTemplateKey: template.key,
        templateName: this.systemTemplateName(template.key),
        scope: "SYSTEM" as const,
        version: template.version,
        marketType: template.marketType,
        tradeStyle: template.tradeStyle,
        instrumentType: template.instrumentType,
        status: "ACTIVE" as const,
        isReadonly: true,
        isLatest: true,
        usedCount: 0,
      })),
      ...userTemplates.map((template) => this.toSummary(template)),
    ];
  }

  public getSystemTemplate(templateKey: ScoringTemplateKey): ResolvedScoringTemplateDefinition {
    return this.systemToResolved(this.registry.getForScoreCheck(templateKey, 1));
  }

  public async getUserTemplate(userId: string, templateId: string): Promise<ResolvedScoringTemplateDefinition> {
    const template = await this.getOwnedTemplate(userId, templateId);
    return this.docToResolved(template);
  }

  public async duplicateSystemTemplate(
    userId: string,
    templateKey: ScoringTemplateKey,
    input: DuplicateScoringTemplateInput,
  ): Promise<ResolvedScoringTemplateDefinition> {
    const userObjectId = this.toObjectId(userId, "user id");
    const system = this.registry.getForDuplication(templateKey, 1);
    const sections = this.systemSectionsToEditable(system.sections);
    const templateName = input.templateName?.trim() || `${this.systemTemplateName(templateKey)} Copy`;
    const userTemplateKey = `USER_${templateKey}_${Date.now()}`;
    const resourceConfig = this.normalizeResourceConfig(input.resourceConfig);
    const allowedTradableSymbols = this.normalizeSymbolIdArray(input.allowedTradableSymbols ?? [], "allowedTradableSymbols");
    const sectionOverrides = this.normalizeSectionOverrides(input.sectionOverrides ?? []);
    const snapshotPolicy = this.normalizeSnapshotPolicy(input.snapshotPolicy);

    this.validator.validateTemplate({
      sections,
      permissionThresholds: DEFAULT_SCORING_PERMISSION_THRESHOLDS,
    });
    this.validateSectionOverrides(sectionOverrides);
    await this.validateReferencedSymbols(resourceConfig, allowedTradableSymbols);

    const created = await ScoringTemplateModel.create({
      scope: "USER",
      userId: userObjectId,
      templateKey: userTemplateKey,
      baseTemplateKey: templateKey,
      templateName,
      ...(input.description ? { description: input.description.trim() } : {}),
      marketType: system.marketType,
      tradeStyle: system.tradeStyle,
      instrumentType: system.instrumentType,
      version: 1,
      isLatest: true,
      isReadonly: false,
      visibility: "PRIVATE",
      status: "DRAFT",
      maxScore: system.maxScore,
      ...(system.aggregationMode ? { aggregationMode: system.aggregationMode } : {}),
      sections,
      permissionThresholds: DEFAULT_SCORING_PERMISSION_THRESHOLDS,
      resourceConfig: this.objectIdsToResourceConfig(resourceConfig),
      allowedTradableSymbols,
      sectionOverrides,
      snapshotPolicy,
      createdBy: userObjectId,
      updatedBy: userObjectId,
    });

    return this.docToResolved(created.toObject());
  }

  public async createUserDraft(input: CreateUserDraftTemplateInput): Promise<ResolvedScoringTemplateDefinition> {
    const userObjectId = this.toObjectId(input.userId, "user id");
    const sections = this.normalizeSections(input.sections as EditableScoringSectionDefinition[]);
    this.validator.validateTemplate({ sections, permissionThresholds: DEFAULT_SCORING_PERMISSION_THRESHOLDS });
    const created = await ScoringTemplateModel.create({ scope: "USER", userId: userObjectId, templateKey: input.templateKey.trim().toUpperCase(), baseTemplateKey: input.baseTemplateKey, templateName: input.templateName.trim(), ...(input.description ? { description: input.description.trim() } : {}), marketType: input.marketType, tradeStyle: input.tradeStyle.trim().toUpperCase(), instrumentType: input.instrumentType, version: 1, isLatest: true, isReadonly: false, visibility: "PRIVATE", status: "DRAFT", maxScore: 100, aggregationMode: "WEIGHTED_SUM", sections, permissionThresholds: DEFAULT_SCORING_PERMISSION_THRESHOLDS, resourceConfig: {}, allowedTradableSymbols: [], sectionOverrides: [], snapshotPolicy: this.defaultSnapshotPolicy(), usedCount: 0, createdBy: userObjectId, updatedBy: userObjectId });
    return this.docToResolved((created as unknown as { toObject: () => ScoringTemplate }).toObject());
  }

  public async findOwnedDraftByTemplateKey(
    userId: string,
    templateKey: string,
  ): Promise<ResolvedScoringTemplateDefinition | null> {
    const userObjectId = this.toObjectId(userId, "user id");
    const template = await ScoringTemplateModel.findOne({
      scope: "USER",
      userId: userObjectId,
      templateKey: templateKey.trim().toUpperCase(),
      version: 1,
      status: "DRAFT",
    }).lean();
    return template ? this.docToResolved(template as ScoringTemplate) : null;
  }

  public async updateUserTemplate(
    userId: string,
    templateId: string,
    input: UpdateScoringTemplateInput,
  ): Promise<ResolvedScoringTemplateDefinition> {
    const userObjectId = this.toObjectId(userId, "user id");
    const existing = await this.getOwnedTemplate(userId, templateId);
    if (existing.isReadonly || existing.scope !== "USER") {
      throw new AppError("SYSTEM_TEMPLATE_READONLY", 403);
    }
    if (existing.status === "ARCHIVED") {
      throw new AppError("SCORING_TEMPLATE_ARCHIVED", 409);
    }

    const nextSections = this.normalizeSections(
      (input.sections ?? existing.sections) as unknown as EditableScoringSectionDefinition[],
    );
    const nextThresholds = input.permissionThresholds
      ?? (existing.permissionThresholds as ScoringPermissionThresholds | undefined)
      ?? DEFAULT_SCORING_PERMISSION_THRESHOLDS;
    const nextResourceConfig = input.resourceConfig !== undefined
      ? this.normalizeResourceConfig(input.resourceConfig)
      : this.normalizeResourceConfig(existing.resourceConfig as unknown as ScoringTemplateResourceConfig | undefined);
    const nextAllowedTradableSymbols = input.allowedTradableSymbols !== undefined
      ? this.normalizeSymbolIdArray(input.allowedTradableSymbols, "allowedTradableSymbols")
      : this.normalizeSymbolIdArray((existing.allowedTradableSymbols ?? []).map(String), "allowedTradableSymbols");
    const nextSectionOverrides = input.sectionOverrides !== undefined
      ? this.normalizeSectionOverrides(input.sectionOverrides)
      : this.normalizeSectionOverrides(existing.sectionOverrides as ScoringTemplateSectionOverride[] | undefined ?? []);
    const nextSnapshotPolicy = input.snapshotPolicy !== undefined
      ? this.normalizeSnapshotPolicy(input.snapshotPolicy)
      : this.normalizeSnapshotPolicy(existing.snapshotPolicy as ScoringTemplateSnapshotPolicy | undefined);
    this.validator.validateTemplate({
      sections: nextSections,
      permissionThresholds: nextThresholds,
    });
    this.validateSectionOverrides(nextSectionOverrides);
    await this.validateReferencedSymbols(nextResourceConfig, nextAllowedTradableSymbols);

    const updatePayload: Record<string, unknown> = {
      ...(input.templateName ? { templateName: input.templateName.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      sections: nextSections,
      permissionThresholds: nextThresholds,
      resourceConfig: this.objectIdsToResourceConfig(nextResourceConfig),
      allowedTradableSymbols: nextAllowedTradableSymbols,
      sectionOverrides: nextSectionOverrides,
      snapshotPolicy: nextSnapshotPolicy,
      updatedBy: userObjectId,
    };

    if ((existing.usedCount ?? 0) > 0) {
      await ScoringTemplateModel.updateMany(
        { userId: userObjectId, templateKey: existing.templateKey },
        { $set: { isLatest: false } },
      ).exec();
      const { _id, createdAt, updatedAt, lastUsedAt, ...copy } = existing as Record<string, unknown>;
      const created = await ScoringTemplateModel.create({
        ...copy,
        _id: new Types.ObjectId(),
        version: existing.version + 1,
        isLatest: true,
        usedCount: 0,
        ...updatePayload,
      });
      return this.docToResolved((created as unknown as { toObject: () => ScoringTemplate }).toObject());
    }

    const updated = await ScoringTemplateModel.findOneAndUpdate(
      { _id: existing._id, userId: userObjectId },
      { $set: updatePayload },
      { new: true },
    ).lean().exec();
    if (!updated) throw new AppError("SCORING_TEMPLATE_NOT_FOUND", 404);
    return this.docToResolved(updated);
  }

  public async archiveUserTemplate(userId: string, templateId: string): Promise<ScoringTemplateSummary> {
    const userObjectId = this.toObjectId(userId, "user id");
    const templateObjectId = this.toObjectId(templateId, "template id");
    const updated = await ScoringTemplateModel.findOneAndUpdate(
      { _id: templateObjectId, userId: userObjectId, scope: "USER" },
      { $set: { status: "ARCHIVED", isLatest: false, updatedBy: userObjectId } },
      { new: true },
    ).lean().exec();
    if (!updated) throw new AppError("SCORING_TEMPLATE_NOT_FOUND", 404);
    return this.toSummary(updated);
  }

  public async resolveForScoreCheck(input: {
    userId: string;
    scoringTemplateKey?: string;
    scoringTemplateId?: string;
  }): Promise<ResolvedScoringTemplateDefinition> {
    if (input.scoringTemplateId) {
      const template = await this.getOwnedTemplate(input.userId, input.scoringTemplateId);
      if (template.status !== "ACTIVE") {
        throw new AppError("SCORING_TEMPLATE_NOT_ACTIVE", 409);
      }
      return this.docToResolved(template);
    }

    const key = input.scoringTemplateKey;
    if (!key) throw new AppError("scoringTemplateKey or scoringTemplateId is required", 400);
    if (SCORING_TEMPLATE_KEYS.includes(key as ScoringTemplateKey)) {
      return this.getSystemTemplate(key as ScoringTemplateKey);
    }

    const userObjectId = this.toObjectId(input.userId, "user id");
    const template = await ScoringTemplateModel.findOne({
      userId: userObjectId,
      templateKey: key.trim().toUpperCase(),
      status: "ACTIVE",
      isLatest: true,
    }).lean().exec();
    if (!template) throw new AppError("SCORING_TEMPLATE_NOT_FOUND", 404);
    return this.docToResolved(template);
  }

  public async markUsed(template: ResolvedScoringTemplateDefinition): Promise<void> {
    if (template.scope !== "USER" || !template.id) return;
    await ScoringTemplateModel.updateOne(
      { _id: this.toObjectId(template.id, "template id"), scope: "USER" },
      { $inc: { usedCount: 1 }, $set: { lastUsedAt: new Date() } },
    ).exec();
  }

  private async getOwnedTemplate(userId: string, templateId: string): Promise<ScoringTemplate & { _id: Types.ObjectId }> {
    const template = await ScoringTemplateModel.findOne({
      _id: this.toObjectId(templateId, "template id"),
      userId: this.toObjectId(userId, "user id"),
    }).lean().exec();
    if (!template) throw new AppError("SCORING_TEMPLATE_NOT_FOUND", 404);
    return template as ScoringTemplate & { _id: Types.ObjectId };
  }

  private systemToResolved(template: ReturnType<ScoringTemplateRegistryService["get"]>): ResolvedScoringTemplateDefinition {
    return {
      templateKey: template.key,
      baseTemplateKey: template.key,
      templateName: this.systemTemplateName(template.key),
      scope: "SYSTEM",
      version: template.version,
      marketType: template.marketType,
      tradeStyle: template.tradeStyle,
      instrumentType: template.instrumentType,
      maxScore: template.maxScore,
      ...(template.aggregationMode ? { aggregationMode: template.aggregationMode } : {}),
      sections: this.systemSectionsToEditable(template.sections),
      permissionThresholds: DEFAULT_SCORING_PERMISSION_THRESHOLDS,
      resourceConfig: {},
      allowedTradableSymbols: [],
      sectionOverrides: [],
      snapshotPolicy: this.defaultSnapshotPolicy(),
    };
  }

  private docToResolved(template: ScoringTemplate & { _id?: Types.ObjectId }): ResolvedScoringTemplateDefinition {
    return {
      id: String(template._id),
      templateKey: template.templateKey,
      baseTemplateKey: template.baseTemplateKey as ScoringTemplateKey,
      templateName: template.templateName,
      ...(template.description ? { description: template.description } : {}),
      scope: template.scope as "SYSTEM" | "USER",
      version: template.version,
      marketType: template.marketType as MarketType,
      tradeStyle: template.tradeStyle,
      instrumentType: template.instrumentType as InstrumentType,
      maxScore: template.maxScore,
      ...(template.aggregationMode ? { aggregationMode: template.aggregationMode as "NORMALIZE_EXECUTED" | "WEIGHTED_SUM" } : {}),
      sections: template.sections as EditableScoringSectionDefinition[],
      permissionThresholds: template.permissionThresholds as ScoringPermissionThresholds,
      resourceConfig: this.normalizeResourceConfig(template.resourceConfig as unknown as ScoringTemplateResourceConfig | undefined),
      allowedTradableSymbols: this.normalizeSymbolIdArray((template.allowedTradableSymbols ?? []).map(String), "allowedTradableSymbols"),
      sectionOverrides: this.normalizeSectionOverrides(template.sectionOverrides as ScoringTemplateSectionOverride[] | undefined ?? []),
      snapshotPolicy: this.normalizeSnapshotPolicy(template.snapshotPolicy as ScoringTemplateSnapshotPolicy | undefined),
    };
  }

  private toSummary(template: ScoringTemplate & { _id?: Types.ObjectId }): ScoringTemplateSummary {
    return {
      id: String(template._id),
      templateKey: template.templateKey,
      baseTemplateKey: template.baseTemplateKey as ScoringTemplateKey,
      templateName: template.templateName,
      ...(template.description ? { description: template.description } : {}),
      scope: template.scope as "SYSTEM" | "USER",
      version: template.version,
      marketType: template.marketType as MarketType,
      tradeStyle: template.tradeStyle,
      instrumentType: template.instrumentType as InstrumentType,
      status: template.status as "ACTIVE" | "DRAFT" | "ARCHIVED",
      isReadonly: template.isReadonly,
      isLatest: template.isLatest,
      usedCount: template.usedCount,
      ...(template.lastUsedAt ? { lastUsedAt: template.lastUsedAt } : {}),
      resourceConfig: this.normalizeResourceConfig(template.resourceConfig as unknown as ScoringTemplateResourceConfig | undefined),
      allowedTradableSymbols: this.normalizeSymbolIdArray((template.allowedTradableSymbols ?? []).map(String), "allowedTradableSymbols"),
      sectionOverrides: this.normalizeSectionOverrides(template.sectionOverrides as ScoringTemplateSectionOverride[] | undefined ?? []),
      snapshotPolicy: this.normalizeSnapshotPolicy(template.snapshotPolicy as ScoringTemplateSnapshotPolicy | undefined),
    };
  }

  private systemSectionsToEditable(
    sections: ReturnType<ScoringTemplateRegistryService["get"]>["sections"],
  ): EditableScoringSectionDefinition[] {
    return sections.map((section) => ({
      sectionKey: section.key,
      label: section.label,
      weight: section.weight,
      enabled: true,
      missingDataPolicy: section.missingDataPolicy,
      evaluators: section.evaluators.map((evaluatorKey, index) => {
        const baseWeight = Number((100 / section.evaluators.length).toFixed(4));
        const priorWeight = Number((baseWeight * (section.evaluators.length - 1)).toFixed(4));
        const weight = index === section.evaluators.length - 1
          ? Number((100 - priorWeight).toFixed(4))
          : baseWeight;
        return {
          evaluatorKey,
          label: evaluatorKey,
          weight,
          enabled: true,
          missingDataPolicy: section.missingDataPolicy,
          config: {},
        };
      }),
    }));
  }

  private normalizeSections(sections: EditableScoringSectionDefinition[]): EditableScoringSectionDefinition[] {
    return sections.map((section) => ({
      sectionKey: section.sectionKey.trim().toUpperCase(),
      label: section.label.trim(),
      weight: section.weight,
      enabled: section.enabled,
      missingDataPolicy: section.missingDataPolicy,
      evaluators: section.evaluators.map((evaluator) => ({
        evaluatorKey: evaluator.evaluatorKey.trim().toUpperCase(),
        label: evaluator.label.trim(),
        weight: evaluator.weight,
        enabled: evaluator.enabled,
        ...(evaluator.missingDataPolicy ? { missingDataPolicy: evaluator.missingDataPolicy } : {}),
        ...(evaluator.config ? { config: evaluator.config } : {}),
      })),
    }));
  }

  private normalizeResourceConfig(
    config: ScoringTemplateResourceConfig | undefined,
  ): ScoringTemplateResourceConfig {
    const marketRegime = config?.marketRegime ?? {};
    const sectorContext = config?.sectorContext ?? {};
    const relatedSymbols = this.normalizeSymbolIdArray(config?.relatedSymbols ?? [], "resourceConfig.relatedSymbols");
    return {
      marketRegime: {
        ...(marketRegime.marketIndexSymbolId ? { marketIndexSymbolId: String(marketRegime.marketIndexSymbolId) } : {}),
        ...(marketRegime.bankIndexSymbolId ? { bankIndexSymbolId: String(marketRegime.bankIndexSymbolId) } : {}),
        ...(marketRegime.volatilitySymbolId ? { volatilitySymbolId: String(marketRegime.volatilitySymbolId) } : {}),
      },
      sectorContext: {
        ...(sectorContext.sectorName?.trim() ? { sectorName: sectorContext.sectorName.trim() } : {}),
        ...(sectorContext.sectorIndexSymbolId ? { sectorIndexSymbolId: String(sectorContext.sectorIndexSymbolId) } : {}),
      },
      relatedSymbols,
    };
  }

  private objectIdsToResourceConfig(config: ScoringTemplateResourceConfig): Record<string, unknown> {
    return {
      marketRegime: {
        ...(config.marketRegime?.marketIndexSymbolId ? { marketIndexSymbolId: this.toObjectId(config.marketRegime.marketIndexSymbolId, "market index symbol id") } : {}),
        ...(config.marketRegime?.bankIndexSymbolId ? { bankIndexSymbolId: this.toObjectId(config.marketRegime.bankIndexSymbolId, "bank index symbol id") } : {}),
        ...(config.marketRegime?.volatilitySymbolId ? { volatilitySymbolId: this.toObjectId(config.marketRegime.volatilitySymbolId, "volatility symbol id") } : {}),
      },
      sectorContext: {
        ...(config.sectorContext?.sectorName ? { sectorName: config.sectorContext.sectorName } : {}),
        ...(config.sectorContext?.sectorIndexSymbolId ? { sectorIndexSymbolId: this.toObjectId(config.sectorContext.sectorIndexSymbolId, "sector index symbol id") } : {}),
      },
      relatedSymbols: (config.relatedSymbols ?? []).map((symbolId) => this.toObjectId(symbolId, "related symbol id")),
    };
  }

  private normalizeSymbolIdArray(symbolIds: string[], label: string): string[] {
    const normalized = symbolIds.map((symbolId) => {
      if (!isValidObjectId(symbolId)) throw new AppError(`Invalid ${label}`, 400);
      return String(symbolId);
    });
    const unique = new Set(normalized);
    if (unique.size !== normalized.length) {
      throw new AppError(`${label} must be unique`, 400);
    }
    return normalized;
  }

  private normalizeSectionOverrides(
    overrides: ScoringTemplateSectionOverride[] = [],
  ): ScoringTemplateSectionOverride[] {
    return overrides.map((override) => ({
      sectionKey: override.sectionKey.trim().toUpperCase(),
      weight: override.weight,
      enabled: override.enabled,
    }));
  }

  private validateSectionOverrides(overrides: ScoringTemplateSectionOverride[]): void {
    if (overrides.length === 0) return;
    const sectionKeys = new Set(overrides.map((override) => override.sectionKey));
    if (sectionKeys.size !== overrides.length) {
      throw new AppError("sectionOverrides sectionKey values must be unique", 400);
    }
    const enabledOverrides = overrides.filter((override) => override.enabled);
    const total = Number(enabledOverrides.reduce((sum, override) => sum + override.weight, 0).toFixed(4));
    if (Math.abs(total - 100) > 0.0001) {
      throw new AppError("Enabled section override weights must total 100", 400);
    }
  }

  private normalizeSnapshotPolicy(
    policy: ScoringTemplateSnapshotPolicy | undefined,
  ): ScoringTemplateSnapshotPolicy {
    return {
      ...this.defaultSnapshotPolicy(),
      ...(policy ?? {}),
    };
  }

  private defaultSnapshotPolicy(): ScoringTemplateSnapshotPolicy {
    return {
      captureMarketRegime: true,
      captureSectorContext: true,
      captureRelatedSymbols: true,
      captureAllowedTradableSymbol: true,
      maxSnapshotAgeSeconds: 900,
    };
  }

  private async validateReferencedSymbols(
    resourceConfig: ScoringTemplateResourceConfig,
    allowedTradableSymbols: string[],
  ): Promise<void> {
    const symbolIds = [
      resourceConfig.marketRegime?.marketIndexSymbolId,
      resourceConfig.marketRegime?.bankIndexSymbolId,
      resourceConfig.marketRegime?.volatilitySymbolId,
      resourceConfig.sectorContext?.sectorIndexSymbolId,
      ...(resourceConfig.relatedSymbols ?? []),
      ...allowedTradableSymbols,
    ].filter((value): value is string => Boolean(value));
    if (symbolIds.length === 0) return;

    const uniqueObjectIds = [...new Set(symbolIds)].map((symbolId) => this.toObjectId(symbolId, "symbol id"));
    const count = await this.countSymbolsByIds(uniqueObjectIds);
    if (count !== uniqueObjectIds.length) {
      throw new AppError("One or more scoring template symbol references do not exist", 400);
    }
  }

  private async countSymbolsByIds(symbolIds: Types.ObjectId[]): Promise<number> {
    if (this.dependencies.countSymbolsByIds) {
      return this.dependencies.countSymbolsByIds(symbolIds);
    }
    return SymbolModel.countDocuments({ _id: { $in: symbolIds } }).exec();
  }

  private systemTemplateName(templateKey: ScoringTemplateKey): string {
    return templateKey
      .replace(/_V\d+$/, "")
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");
  }

  private toObjectId(value: string, label: string): Types.ObjectId {
    if (!isValidObjectId(value)) {
      throw new AppError(`Invalid ${label}`, 400);
    }
    return new Types.ObjectId(value);
  }
}
