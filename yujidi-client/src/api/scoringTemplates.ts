import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type { ScoringTemplateDetail, ScoringTemplateSummary } from '../types/trade'

export const listScoringTemplates = async () =>
  unwrapArrayData<ScoringTemplateSummary>(await apiClient.get('/scoring-templates'))

export const getSystemScoringTemplate = async (templateKey: string) =>
  unwrapData<ScoringTemplateDetail>(await apiClient.get(`/scoring-templates/system/${templateKey}`))

export const getUserScoringTemplate = async (templateId: string) =>
  unwrapData<ScoringTemplateDetail>(await apiClient.get(`/scoring-templates/${templateId}`))

export const duplicateSystemScoringTemplate = async (
  templateKey: string,
  input: { templateName?: string; description?: string } = {},
) =>
  unwrapData<ScoringTemplateDetail>(
    await apiClient.post(`/scoring-templates/system/${templateKey}/duplicate`, input),
  )

export const updateUserScoringTemplate = async (
  templateId: string,
  input: Partial<
    Pick<
      ScoringTemplateDetail,
      | 'templateName'
      | 'description'
      | 'sections'
      | 'permissionThresholds'
      | 'resourceConfig'
      | 'allowedTradableSymbols'
      | 'sectionOverrides'
      | 'snapshotPolicy'
    >
  >,
) =>
  unwrapData<ScoringTemplateDetail>(await apiClient.patch(`/scoring-templates/${templateId}`, input))

export const archiveUserScoringTemplate = async (templateId: string) =>
  unwrapData<ScoringTemplateSummary>(await apiClient.post(`/scoring-templates/${templateId}/archive`))
