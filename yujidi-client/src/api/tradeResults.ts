import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type { TradeJournal, TradeResult } from '../types/trade'

export const listTradeResults = async () =>
  unwrapArrayData<TradeResult>(await apiClient.get('/trade-results'))

export const listTradeResultsForPlan = async (tradePlanId: string) =>
  unwrapArrayData<TradeResult>(await apiClient.get(`/trade-plans/${tradePlanId}/trade-results`))

export const createTradeJournal = async (tradeResultId: string) =>
  unwrapData<TradeJournal>(await apiClient.post(`/trade-results/${tradeResultId}/journal`))
