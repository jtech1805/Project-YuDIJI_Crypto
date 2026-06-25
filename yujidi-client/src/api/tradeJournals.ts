import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type { AiExplanation, TradeJournal, UpdateTradeJournalInput } from '../types/trade'

export const listTradeJournals = async () =>
  unwrapArrayData<TradeJournal>(await apiClient.get('/trade-journals'))

export const updateTradeJournal = async (id: string, input: UpdateTradeJournalInput) =>
  unwrapData<TradeJournal>(await apiClient.patch(`/trade-journals/${id}`, input))

export const finalizeTradeJournal = async (id: string) =>
  unwrapData<TradeJournal>(await apiClient.post(`/trade-journals/${id}/finalize`))

export const generateAiReview = async (id: string) =>
  unwrapData<AiExplanation>(await apiClient.post(`/trade-journals/${id}/ai-review`))
