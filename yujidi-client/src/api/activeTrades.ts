import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type {
  ActiveTrade,
  ActiveTradeEvaluation,
  CloseActiveTradeInput,
  TradeEvent,
  TradeResult,
} from '../types/trade'

export const listActiveTrades = async () =>
  unwrapArrayData<ActiveTrade>(await apiClient.get('/active-trades'))

export const evaluateActiveTrade = async (id: string, price: number) =>
  unwrapData<ActiveTradeEvaluation>(
    await apiClient.post(`/active-trades/${id}/evaluate`, {
      price,
      source: 'MANUAL_EVALUATION',
    }),
  )

export const closeActiveTrade = async (id: string, input: CloseActiveTradeInput) =>
  unwrapData<TradeResult>(await apiClient.post(`/active-trades/${id}/close`, input))

export const cancelActiveTrade = async (id: string) =>
  unwrapData<ActiveTrade>(await apiClient.post(`/active-trades/${id}/cancel`))

export const listActiveTradeEvents = async (id: string) =>
  unwrapArrayData<TradeEvent>(await apiClient.get(`/active-trades/${id}/events`))
