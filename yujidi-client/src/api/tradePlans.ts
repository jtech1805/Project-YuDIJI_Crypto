import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type { CreateTradePlanInput, TradePlan } from '../types/trade'

export const listTradePlans = async () =>
  unwrapArrayData<TradePlan>(await apiClient.get('/trade-plans'))

export const createTradePlan = async (input: CreateTradePlanInput) =>
  unwrapData<TradePlan>(await apiClient.post('/trade-plans', input))

export const activateTradePlan = async (id: string) =>
  unwrapData<TradePlan>(await apiClient.post(`/trade-plans/${id}/activate`))

export const pauseTradePlan = async (id: string) =>
  unwrapData<TradePlan>(await apiClient.post(`/trade-plans/${id}/pause`))
