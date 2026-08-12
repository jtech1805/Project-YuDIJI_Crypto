import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type {
  ActiveTrade,
  ConfirmActualTradeInput,
  RetryTradeSetupRiskCheckInput,
  RetryTradeSetupRiskCheckResult,
  TradeSetup,
  UpdateTradeSetupInput,
} from '../types/trade'

export const listTradeSetups = async () =>
  unwrapArrayData<TradeSetup>(await apiClient.get('/trade-setups'))

export const listTradeSetupsForPlan = async (tradePlanId: string) =>
  unwrapArrayData<TradeSetup>(await apiClient.get(`/trade-plans/${tradePlanId}/trade-setups`))

export const cancelTradeSetup = async (id: string) =>
  unwrapData<TradeSetup>(await apiClient.post(`/trade-setups/${id}/cancel`))

export const confirmActualTrade = async (id: string, input: ConfirmActualTradeInput) =>
  unwrapData<ActiveTrade>(
    await apiClient.post(`/trade-setups/${id}/confirm-actual-trade`, input),
  )

export const updateTradeSetup = async (id: string, input: UpdateTradeSetupInput) =>
  unwrapData<TradeSetup>(await apiClient.patch(`/trade-setups/${id}`, input))

export const retryTradeSetupRiskCheck = async (
  id: string,
  input: RetryTradeSetupRiskCheckInput,
) =>
  unwrapData<RetryTradeSetupRiskCheckResult>(
    await apiClient.post(`/trade-setups/${id}/retry-risk-check`, input),
  )

export const deleteTradeSetup = async (
  id: string,
  input: { reason?: string; deleteLinkedScoreCheck?: boolean } = {},
) => unwrapData<TradeSetup>(await apiClient.delete(`/trade-setups/${id}`, { data: input }))
