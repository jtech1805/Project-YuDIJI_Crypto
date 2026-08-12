import { apiClient } from './client'
import { unwrapData } from './tradeApi'
import type { AiExplanation } from '../types/trade'

export const getAiExplanation = async (id: string) =>
  unwrapData<AiExplanation>(await apiClient.get(`/ai-explanations/${id}`))
