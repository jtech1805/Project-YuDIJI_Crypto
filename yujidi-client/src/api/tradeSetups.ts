import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type { ActiveTrade, ConfirmActualTradeInput, TradeSetup } from '../types/trade'

export const listTradeSetups = async () =>
  unwrapArrayData<TradeSetup>(await apiClient.get('/trade-setups'))

export const cancelTradeSetup = async (id: string) =>
  unwrapData<TradeSetup>(await apiClient.post(`/trade-setups/${id}/cancel`))

export const confirmActualTrade = async (id: string, input: ConfirmActualTradeInput) =>
  unwrapData<ActiveTrade>(
    await apiClient.post(`/trade-setups/${id}/confirm-actual-trade`, input),
  )
