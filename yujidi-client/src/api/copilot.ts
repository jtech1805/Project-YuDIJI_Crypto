import { AxiosError } from 'axios'

import { apiClient } from './client'

export interface CopilotConceptPreview {
  conceptId: string
  label: string
}

export interface CopilotSubjectPreview {
  type: string
  key: string
  displayName?: string
}

export interface CopilotDraftPreview {
  preview: true
  authority: 'NON_AUTHORITATIVE_PREVIEW'
  subject: CopilotSubjectPreview
  title?: string
  description?: string
  supportedConcepts: CopilotConceptPreview[]
  bindings: Array<{
    bindingReviewId: string
    label: string
    relationship: 'DIRECT' | 'INVERSE'
  }>
  unresolvedConcepts: CopilotConceptPreview[]
  requiresUserWeights: boolean
}

export type CopilotTemplateDraftResponse =
  | {
      status: 'success'
      review: { reviewId: string; reviewVersion: number; expiresAt: string }
      draft: CopilotDraftPreview
    }
  | { status: 'unsupported'; draft: CopilotDraftPreview }
  | { status: 'needs_clarification'; questions: string[] }
  | {
      status: 'unavailable'
      code: 'COPILOT_UNAVAILABLE' | 'INVALID_REQUEST' | 'REQUEST_TIMEOUT' | 'CALLER_CANCELLED'
    }

export interface AcceptCopilotTemplateDraftRequest {
  reviewVersion: number
  template: {
    baseTemplateKey: string
    templateName: string
    description?: string
    marketType: string
    tradeStyle: string
    instrumentType: string
  }
  acceptedBindings: Array<{ bindingReviewId: string; weight: number }>
}

export type AcceptCopilotTemplateDraftResponse =
  | {
      status: 'created'
      template: { id: string; templateKey: string; version: number; scope: 'USER'; status: 'DRAFT' }
    }
  | {
      status: 'rejected'
      code:
        | 'REVIEW_NOT_FOUND'
        | 'REVIEW_EXPIRED'
        | 'REVIEW_ALREADY_ACCEPTED'
        | 'REVIEW_OWNER_MISMATCH'
        | 'UNRESOLVED_CONCEPTS_PRESENT'
        | 'INVALID_BINDING_SELECTION'
        | 'INVALID_WEIGHT'
        | 'STALE_GENERATION'
        | 'ACCEPTANCE_REJECTED'
        | 'PERSISTENCE_FAILED'
      template?: { id: string; templateKey: string; version: number }
    }

export async function createCopilotTemplateDraft(
  prompt: string,
): Promise<CopilotTemplateDraftResponse> {
  const response = await apiClient.post<CopilotTemplateDraftResponse>('/copilot/template-drafts', {
    prompt,
  })

  return response.data
}

export async function acceptCopilotTemplateDraft(
  reviewId: string,
  input: AcceptCopilotTemplateDraftRequest,
): Promise<AcceptCopilotTemplateDraftResponse> {
  const response = await apiClient.post<AcceptCopilotTemplateDraftResponse>(
    `/copilot/template-drafts/${encodeURIComponent(reviewId)}/accept`,
    input,
  )
  return response.data
}

export function getCopilotErrorMessage(error: unknown): string {
  if (!(error instanceof AxiosError)) {
    return 'Something went wrong while preparing your draft. Please try again.'
  }

  if (!error.response) {
    return 'We could not reach Copilot. Check your connection and try again.'
  }

  switch (error.response.status) {
    case 400:
      return 'Please review your request and try again.'
    case 401:
      return 'Please sign in to use Copilot.'
    case 403:
      return 'You do not have access to Copilot.'
    case 503:
      return 'Copilot is temporarily unavailable. Please try again.'
    case 504:
      return 'This request took too long. Try again with a simpler request.'
    default:
      return 'Something went wrong while preparing your draft. Please try again.'
  }
}
