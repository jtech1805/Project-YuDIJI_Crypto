import { apiClient } from './client'
import { unwrapArrayData } from './tradeApi'
import type { TradeEvent } from '../types/trade'

export const listTradeEvents = async () =>
  unwrapArrayData<TradeEvent>(await apiClient.get('/trade-events'))

export const listTradeEventsForPlan = async (tradePlanId: string) =>
  unwrapArrayData<TradeEvent>(await apiClient.get(`/trade-plans/${tradePlanId}/trade-events`))
