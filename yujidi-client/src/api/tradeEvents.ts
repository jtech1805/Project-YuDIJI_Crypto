import { apiClient } from './client'
import { unwrapArrayData } from './tradeApi'
import type { TradeEvent } from '../types/trade'

export const listTradeEvents = async () =>
  unwrapArrayData<TradeEvent>(await apiClient.get('/trade-events'))
