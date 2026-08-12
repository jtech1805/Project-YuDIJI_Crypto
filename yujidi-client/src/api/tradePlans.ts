import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type {
  CreateTradePlanInput,
  TradePlan,
  TradePlanDashboardSummary,
  RestartTradePlanInput,
  RestartTradePlanResult,
  ResetRiskLockInput,
  ResetRiskLockResult,
  UpdateTradePlanInput,
} from '../types/trade'

export const listTradePlans = async () =>
  unwrapArrayData<TradePlan>(await apiClient.get('/trade-plans'))

export const createTradePlan = async (input: CreateTradePlanInput) =>
  unwrapData<TradePlan>(await apiClient.post('/trade-plans', input))

export const activateTradePlan = async (id: string) =>
  unwrapData<TradePlan>(await apiClient.post(`/trade-plans/${id}/activate`))

export const pauseTradePlan = async (id: string) =>
  unwrapData<TradePlan>(await apiClient.post(`/trade-plans/${id}/pause`))

export const updateTradePlan = async (id: string, input: UpdateTradePlanInput) =>
  unwrapData<TradePlan>(await apiClient.patch(`/trade-plans/${id}`, input))

export const getTradePlanDashboardSummary = async (id: string) =>
  unwrapData<TradePlanDashboardSummary>(await apiClient.get(`/trade-plans/${id}/dashboard-summary`))

export const resetTradePlanRiskLock = async (id: string, input: ResetRiskLockInput) =>
  unwrapData<ResetRiskLockResult>(await apiClient.post(`/trade-plans/${id}/reset-risk-lock`, input))

export const restartTradePlan = async (id: string, input: RestartTradePlanInput) =>
  unwrapData<RestartTradePlanResult>(await apiClient.post(`/trade-plans/${id}/restart`, input))

export const deleteTradePlan = async (
  id: string,
  input: { reason?: string; cascade?: boolean } = {},
) =>
  unwrapData<{ tradePlan: TradePlan; cascadeSummary: Record<string, number> }>(
    await apiClient.delete(`/trade-plans/${id}`, { data: input }),
  )
